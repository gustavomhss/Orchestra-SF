import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period, SourceRef } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { SfSignalState } from "./signals.ts"

export const SF_SIGNAL_REGISTRY_PREFIX = "sf:memory-condition:"
export type SfSignalSelection = { caseRef: { id: string; incarnation: string; version: number }; choiceId: string; scenarioRefs: readonly [string, string]; source: SourceRef; evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; fields: readonly string[]; period: Period; criterionId: string; recipientRef: string; destination: string; label: string }
export type SfStoredSignalBinding = { schema: "sf-memory-condition-v1"; id: string; selection: SfSignalSelection; principalRef: string; choiceDigest: string; revision: number; signalState?: SfSignalState }

/** Private host adapter: only a human-bound selection can create a durable binding. */
export function createSfSignalRegistry(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: DecisionCasePort
  signalRegistryWrites: WeakSet<object>
  approveReconcile: (record: SfStoredSignalBinding, next: SfSignalState, call: TrustedDomainContext) => Promise<boolean>
  approveSelection: (selection: SfSignalSelection, call: TrustedDomainContext) => Promise<boolean>
  authorizeSelection: (selection: SfSignalSelection, call: TrustedDomainContext) => Promise<boolean>
  checkSourceFence: (snapshot: Snapshot, selection: SfSignalSelection, authority: SfStateAuthority) => Promise<boolean>
  operationIdentity: (call: TrustedDomainContext) => string | undefined
  createId: () => string
}) {
  return {
    async register(requested: SfSignalSelection, call: TrustedDomainContext) {
      try {
        const selection = structuredClone(requested)
        const selectionDigest = digestSfValue(selection)
        const request = input.host.requestFor(call)
        const identity = input.operationIdentity(call)
        const binding = digestSfValue([call.kind, call.binding])
        const unchanged = () => !!request && !request.signal.aborted && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(requested) === selectionDigest && digestSfValue(selection) === selectionDigest
        if (call.kind !== "ui" || !request || request.signal.aborted || !identity || !validSelection(selection, call) || !await input.host.revalidate(call) || !await input.approveSelection(selection, call) || !unchanged()) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== selection.caseRef.id || current.value.case.incarnation !== selection.caseRef.incarnation || current.value.case.version !== selection.caseRef.version || current.value.case.choices.filter((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId)).length !== 1 || current.value.case.criteria.filter((criterion) => criterion.id === selection.criterionId).length !== 1 || !current.value.case.participants.includes(selection.recipientRef) || !current.value.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(selection.evidence)) || !unchanged()) return { status: "unavailable" as const }
        const choiceDigest = digestSfValue(current.value.case.choices.find((choice) => choice.id === selection.choiceId))
        if (!await input.authorizeSelection(selection, call) || !unchanged()) return { status: "unavailable" as const }
        const before = await input.state.read(request, "preferences", () => null)
        const id = input.createId()
        if (before.status !== "ok" || !id.trim() || !await input.approveSelection(selection, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
          const value = state.cases[selection.caseRef.id]
          if (!unchanged() || authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion || !value || value.incarnation !== selection.caseRef.incarnation || value.version !== selection.caseRef.version || !value.participants.includes(authority.principalRef) || !value.participants.includes(selection.recipientRef) || !await input.checkSourceFence(snapshot, selection, authority) || !unchanged()) return { commit: false, value: false }
          const key = `${SF_SIGNAL_REGISTRY_PREFIX}${id}`
          if (Object.hasOwn(state.preferences, key)) return { commit: false, value: false }
          const chosen = value.choices.find((choice) => choice.id === selection.choiceId)
          if (!chosen || digestSfValue(chosen) !== choiceDigest) return { commit: false, value: false }
          const record: SfStoredSignalBinding = { schema: "sf-memory-condition-v1", id, selection: structuredClone(selection), principalRef: authority.principalRef, choiceDigest, revision: 1 }
          state.preferences[key] = record
          return { commit: true, value: true }
        }
        input.signalRegistryWrites.add(work)
        const saved = await input.state.transaction(request, { namespace: "preferences", domainSurface: selection.source.surface, expectedStorageVersion: before.storageVersion, targetRef: encodeCaseRef(selection.caseRef), targetIncarnation: selection.caseRef.incarnation, idempotencyKey: `signal-condition:${identity}`, commandDigest: digestSfValue(selection) }, work).finally(() => input.signalRegistryWrites.delete(work))
        if (saved.status !== "ok" || !saved.value || !unchanged() || !await input.authorizeSelection(selection, call) || !await input.approveSelection(selection, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        return { status: "ok" as const }
      } catch {
        return { status: "unavailable" as const }
      }
    },
    /** Host-only: an approved replacement preserves the condition identity and prior dedupe state. */
    async revise(existing: SfStoredSignalBinding, requested: SfSignalSelection, call: TrustedDomainContext) {
      try {
        const previous = structuredClone(existing)
        const selection = structuredClone(requested)
        const selectionDigest = digestSfValue(selection)
        const previousDigest = digestSfValue(previous)
        const request = input.host.requestFor(call)
        const identity = input.operationIdentity(call)
        const binding = digestSfValue([call.kind, call.binding])
        const unchanged = () => !!request && !request.signal.aborted && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(requested) === selectionDigest && digestSfValue(selection) === selectionDigest && digestSfValue(existing) === previousDigest && digestSfValue(previous) === previousDigest
        if (call.kind !== "ui" || !request || request.signal.aborted || !identity || !validRecord(previous, `${SF_SIGNAL_REGISTRY_PREFIX}${previous.id}`, call) || (previous.principalRef !== call.binding.principalRef && previous.selection.recipientRef !== call.binding.principalRef) || !validSelection(selection, call) || selection.caseRef.id !== previous.selection.caseRef.id || selection.caseRef.incarnation !== previous.selection.caseRef.incarnation || selection.caseRef.version < previous.selection.caseRef.version || selection.choiceId !== previous.selection.choiceId || selection.criterionId !== previous.selection.criterionId || !await input.host.revalidate(call) || !await input.approveSelection(selection, call) || !unchanged()) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== selection.caseRef.id || current.value.case.incarnation !== selection.caseRef.incarnation || current.value.case.version !== selection.caseRef.version || current.value.case.choices.filter((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionId) && digestSfValue(choice) === previous.choiceDigest).length !== 1 || !current.value.case.participants.includes(selection.recipientRef) || !current.value.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(selection.evidence)) || !await input.authorizeSelection(selection, call) || !unchanged()) return { status: "unavailable" as const }
        const before = await input.state.read(request, "preferences", (state) => state.preferences[`${SF_SIGNAL_REGISTRY_PREFIX}${previous.id}`])
        if (before.status !== "ok" || digestSfValue(before.value) !== previousDigest || !await input.approveSelection(selection, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
          const key = `${SF_SIGNAL_REGISTRY_PREFIX}${previous.id}`
          const actual = state.cases[selection.caseRef.id]
          if (!unchanged() || authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion || digestSfValue(state.preferences[key]) !== previousDigest || !actual || actual.incarnation !== selection.caseRef.incarnation || actual.version !== selection.caseRef.version || !actual.participants.includes(authority.principalRef) || !actual.participants.includes(selection.recipientRef) || actual.choices.filter((choice) => choice.id === selection.choiceId && digestSfValue(choice) === previous.choiceDigest).length !== 1 || !await input.checkSourceFence(snapshot, selection, authority) || !unchanged()) return { commit: false, value: false }
          state.preferences[key] = structuredClone({ ...previous, selection, revision: previous.revision + 1 })
          return { commit: true, value: true }
        }
        input.signalRegistryWrites.add(work)
        const saved = await input.state.transaction(request, { namespace: "preferences", domainSurface: selection.source.surface, expectedStorageVersion: before.storageVersion, targetRef: encodeCaseRef(selection.caseRef), targetIncarnation: selection.caseRef.incarnation, idempotencyKey: `signal-revise:${identity}`, commandDigest: digestSfValue({ id: previous.id, revision: previous.revision, selection }) }, work).finally(() => input.signalRegistryWrites.delete(work))
        if (saved.status !== "ok" || !saved.value || !unchanged() || !await input.authorizeSelection(selection, call) || !await input.approveSelection(selection, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        return { status: "ok" as const }
      } catch {
        return { status: "unavailable" as const }
      }
    },
    /** Host-only: browser clients do not choose condition IDs or previous state. */
    async list(requested: SfSignalSelection["caseRef"], call: TrustedDomainContext) {
      try {
        const caseRef = structuredClone(requested)
        const requestDigest = digestSfValue(caseRef)
        const request = input.host.requestFor(call)
        const binding = digestSfValue([call.kind, call.binding])
        const unchanged = () => !!request && !request.signal.aborted && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(requested) === requestDigest && digestSfValue(caseRef) === requestDigest
        if (!request || request.signal.aborted || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== caseRef.id || current.value.case.incarnation !== caseRef.incarnation || current.value.case.version !== caseRef.version || !unchanged()) return { status: "unavailable" as const }
        const projection = structuredClone(current.value)
        const caseDigest = digestSfValue(projection.case)
        const read = () => input.state.read(request, "preferences", (state, authority) => {
          if (authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion) return undefined
          return Object.entries(state.preferences).filter(([key]) => key.startsWith(SF_SIGNAL_REGISTRY_PREFIX)).flatMap(([key, value]) => {
            const record = value as SfStoredSignalBinding
            return validRecord(record, key, call) && record.selection.caseRef.id === caseRef.id && record.selection.caseRef.incarnation === caseRef.incarnation && record.selection.caseRef.version <= caseRef.version && record.selection.recipientRef === call.binding.principalRef ? [record] : []
          })
        })
        const first = await read()
        if (first.status !== "ok" || !first.value || !unchanged()) return { status: "unavailable" as const }
        const records = structuredClone(first.value)
        const recordsDigest = digestSfValue(records)
        const visible: SfStoredSignalBinding[] = []
        for (const record of records) {
          if (projection.case.choices.filter((choice) => choice.id === record.selection.choiceId && choice.criteria.includes(record.selection.criterionId) && digestSfValue(choice) === record.choiceDigest).length !== 1 || projection.case.criteria.filter((criterion) => criterion.id === record.selection.criterionId).length !== 1 || !projection.case.participants.includes(record.selection.recipientRef) || !projection.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(record.selection.evidence))) continue
          const authorized = await input.authorizeSelection(record.selection, call)
          if (!unchanged() || digestSfValue(records) !== recordsDigest) return { status: "unavailable" as const }
          if (authorized) visible.push(record)
        }
        const again = await read()
        if (again.status !== "ok" || !again.value || first.storageVersion !== again.storageVersion || digestSfValue(again.value) !== recordsDigest || !unchanged() || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        for (const record of visible) if (!await input.authorizeSelection(record.selection, call)) return { status: "unavailable" as const }
        const latest = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (latest.status !== "ok") return { status: "unavailable" as const }
        const latestCaseDigest = digestSfValue(latest.value.case)
        if (!await input.host.revalidate(call) || latestCaseDigest !== caseDigest || digestSfValue(latest.value.case) !== latestCaseDigest || digestSfValue(records) !== recordsDigest || !unchanged()) return { status: "unavailable" as const }
        return { status: "ok" as const, records: structuredClone(visible) }
      } catch {
        return { status: "unavailable" as const }
      }
    },
    /** Host-only: next state must be recomputed and approved by the current source producer. */
    async reconcile(record: SfStoredSignalBinding, next: SfSignalState, call: TrustedDomainContext) {
      try {
        const requested = structuredClone(record)
        const state = structuredClone(next)
        const recordDigest = digestSfValue(requested)
        const stateDigest = digestSfValue(state)
        const request = input.host.requestFor(call)
        const binding = digestSfValue([call.kind, call.binding])
        const unchanged = () => !!request && !request.signal.aborted && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(record) === recordDigest && digestSfValue(requested) === recordDigest && digestSfValue(next) === stateDigest && digestSfValue(state) === stateDigest
        if (!request || request.signal.aborted || !validRecord(requested, `${SF_SIGNAL_REGISTRY_PREFIX}${requested.id}`, call) || requested.selection.recipientRef !== call.binding.principalRef || state.conditionId !== requested.id || !validSignalState(state) || !await input.host.revalidate(call) || !await input.authorizeSelection(requested.selection, call) || !await input.approveReconcile(requested, state, call) || !unchanged()) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(requested.selection.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== requested.selection.caseRef.id || current.value.case.incarnation !== requested.selection.caseRef.incarnation || current.value.case.version < requested.selection.caseRef.version || current.value.case.choices.filter((choice) => choice.id === requested.selection.choiceId && digestSfValue(choice) === requested.choiceDigest).length !== 1 || !unchanged()) return { status: "unavailable" as const }
        const caseVersion = current.value.case.version
        const before = await input.state.read(request, "preferences", (value) => value.preferences[`${SF_SIGNAL_REGISTRY_PREFIX}${requested.id}`])
        if (before.status !== "ok" || digestSfValue(before.value) !== recordDigest || !unchanged()) return { status: "unavailable" as const }
        if (digestSfValue(requested.signalState) === digestSfValue(state)) {
          if (!await input.authorizeSelection(requested.selection, call) || !await input.approveReconcile(requested, state, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
          return { status: "ok" as const, record: structuredClone(requested) }
        }
        const attempt = input.createId()
        if (!attempt.trim() || !await input.approveReconcile(requested, state, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        const work = async (product: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
          const key = `${SF_SIGNAL_REGISTRY_PREFIX}${requested.id}`
          const actual = product.cases[requested.selection.caseRef.id]
          if (!unchanged() || authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion || digestSfValue(product.preferences[key]) !== recordDigest || !actual || actual.incarnation !== requested.selection.caseRef.incarnation || actual.version !== caseVersion || actual.choices.filter((choice) => choice.id === requested.selection.choiceId && digestSfValue(choice) === requested.choiceDigest).length !== 1 || !actual.participants.includes(authority.principalRef) || !await input.checkSourceFence(snapshot, requested.selection, authority) || !unchanged()) return { commit: false, value: false }
          product.preferences[key] = structuredClone({ ...requested, revision: requested.revision + 1, signalState: state })
          return { commit: true, value: true }
        }
        input.signalRegistryWrites.add(work)
        const saved = await input.state.transaction(request, { namespace: "preferences", domainSurface: requested.selection.source.surface, expectedStorageVersion: before.storageVersion, targetRef: encodeCaseRef(requested.selection.caseRef), targetIncarnation: requested.selection.caseRef.incarnation, idempotencyKey: `signal-state:${attempt}`, commandDigest: digestSfValue({ id: requested.id, revision: requested.revision, state }) }, work).finally(() => input.signalRegistryWrites.delete(work))
        if (saved.status !== "ok" || !saved.value || !unchanged() || !await input.authorizeSelection(requested.selection, call) || !await input.approveReconcile(requested, state, call) || !await input.host.revalidate(call) || !unchanged()) return { status: "unavailable" as const }
        return { status: "ok" as const, record: structuredClone({ ...requested, revision: requested.revision + 1, signalState: state }) }
      } catch {
        return { status: "unavailable" as const }
      }
    },
  }
}

function validSignalState(value: SfSignalState) {
  return !!value && typeof value === "object" && typeof value.conditionId === "string" && !!value.conditionId.trim() && typeof value.correlationKey === "string" && !!value.correlationKey.trim() && (value.status === "open" || value.status === "resolved") && Array.isArray(value.seenKeys) && value.seenKeys.every((key) => typeof key === "string" && !!key.trim()) && value.seenKeys.includes(value.correlationKey) && (value.resolutionKey === undefined || typeof value.resolutionKey === "string" && !!value.resolutionKey.trim())
}

function validRecord(record: SfStoredSignalBinding, key: string, call: TrustedDomainContext) {
  return !!record && typeof record === "object" && record.schema === "sf-memory-condition-v1" && typeof record.id === "string" && !!record.id.trim() && key === `${SF_SIGNAL_REGISTRY_PREFIX}${record.id}` && typeof record.principalRef === "string" && !!record.principalRef.trim() && /^[a-f0-9]{64}$/.test(record.choiceDigest) && Number.isSafeInteger(record.revision) && record.revision > 0 && !!record.selection && validSelection(record.selection, call) && (record.signalState === undefined || validSignalState(record.signalState) && record.signalState.conditionId === record.id)
}

function validSelection(selection: SfSignalSelection, call: TrustedDomainContext) {
  const ref = selection.evidence
  return !!selection.caseRef.id.trim() && !!selection.caseRef.incarnation.trim() && Number.isSafeInteger(selection.caseRef.version) && selection.caseRef.version > 0 && [selection.choiceId, selection.criterionId, selection.recipientRef, selection.destination, selection.label].every((value) => typeof value === "string" && !!value.trim()) && Array.isArray(selection.scenarioRefs) && selection.scenarioRefs.length === 2 && selection.scenarioRefs.every((ref) => typeof ref === "string" && !!ref.trim()) && selection.scenarioRefs[0] !== selection.scenarioRefs[1] && isSfPeriod(selection.period) && selection.fields.length > 0 && selection.fields.every((field) => typeof field === "string" && !!field.trim()) && new Set(selection.fields).size === selection.fields.length && ref.schema === "sf-evidence-v1" && ref.kind === "record" && !!ref.refId.trim() && /^[a-f0-9]{64}$/.test(ref.target.projectionDigest) && Number.isSafeInteger(ref.target.version) && ref.target.version > 0 && Number.isFinite(Date.parse(selection.source.observedAt)) && ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref) && ref.target.surface === selection.source.surface && ref.target.recordType === selection.source.type && ref.target.recordId === selection.source.id && ref.target.incarnation === selection.source.incarnation && ref.target.version === selection.source.version && selection.fields.every((field) => ref.target.fields.includes(field) && selection.source.fields.includes(field)) && !!ref.target.period && ref.target.period.start <= selection.period.start && ref.target.period.end >= selection.period.end && selection.source.period.start <= selection.period.start && selection.source.period.end >= selection.period.end
}
