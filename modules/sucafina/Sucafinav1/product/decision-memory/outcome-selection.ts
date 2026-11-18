import type { Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, DecisionCasePort } from "../contracts/ports.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { SfOutcomeSelection } from "./domain-outcome.ts"

export const SF_OUTCOME_SELECTION_PREFIX = "sf:memory-outcome:"
type StoredSelection = { schema: "sf-memory-outcome-v1"; principalRef: string; choiceDigest: string; selection: SfOutcomeSelection }

/** The host binds a human selection to the current case and authorized domain observation. */
export function createSfOutcomeSelectionRegistry(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: DecisionCasePort
  signalRegistryWrites: WeakSet<object>
  approveSelection: (selection: SfOutcomeSelection, call: TrustedDomainContext) => Promise<boolean>
  authorizeSelection: (selection: SfOutcomeSelection, call: TrustedDomainContext) => Promise<boolean>
  checkSourceFence: (snapshot: Snapshot, selection: SfOutcomeSelection, authority: SfStateAuthority) => Promise<boolean>
  operationIdentity: (call: TrustedDomainContext) => string | undefined
}) {
  return {
    async register(requested: SfOutcomeSelection, call: TrustedDomainContext) {
      try {
        const selection = structuredClone(requested)
        const request = input.host.requestFor(call)
        const identity = input.operationIdentity(call)
        const binding = digestSfValue([call.kind, call.binding])
        if (call.kind !== "ui" || !request || request.signal.aborted || !identity || !validSelection(selection, call) || !await input.host.revalidate(call) || !await input.approveSelection(selection, call)) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== selection.caseRef.id || current.value.case.incarnation !== selection.caseRef.incarnation || current.value.case.version !== selection.caseRef.version) return { status: "unavailable" as const }
        const choices = current.value.case.choices.filter((choice) => choice.id === selection.choiceId && choice.criteria.includes(selection.criterionRef) && choice.values.filter((value) => value.criterionRef === selection.criterionRef && digestSfValue(value.horizon) === digestSfValue(selection.period)).length === 1)
        if (choices.length !== 1 || current.value.case.criteria.filter((criterion) => criterion.id === selection.criterionRef).length !== 1 || !await input.authorizeSelection(selection, call)) return { status: "unavailable" as const }
        const before = await input.state.read(request, "preferences", () => null)
        if (before.status !== "ok" || !await input.approveSelection(selection, call) || !await input.host.revalidate(call)) return { status: "unavailable" as const }
        const choiceDigest = digestSfValue(choices[0])
        const work = async (state: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
          const currentCase = state.cases[selection.caseRef.id]
          if (authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion || !currentCase || currentCase.incarnation !== selection.caseRef.incarnation || currentCase.version !== selection.caseRef.version || !currentCase.participants.includes(authority.principalRef) || currentCase.choices.filter((choice) => choice.id === selection.choiceId && digestSfValue(choice) === choiceDigest).length !== 1 || !await input.checkSourceFence(snapshot, selection, authority)) return { commit: false, value: false }
          const record: StoredSelection = { schema: "sf-memory-outcome-v1", principalRef: authority.principalRef, choiceDigest, selection }
          state.preferences[key(selection, call)] = record
          return { commit: true, value: true }
        }
        input.signalRegistryWrites.add(work)
        const saved = await input.state.transaction(request, { namespace: "preferences", domainSurface: selection.evidenceRefs[0]!.kind === "record" ? selection.evidenceRefs[0]!.target.surface : undefined, expectedStorageVersion: before.storageVersion, targetRef: encodeCaseRef(selection.caseRef), targetIncarnation: selection.caseRef.incarnation, idempotencyKey: `outcome-selection:${identity}:${selection.caseRef.id}:${selection.caseRef.incarnation}:${selection.choiceId}`, commandDigest: digestSfValue(selection) }, work).finally(() => input.signalRegistryWrites.delete(work))
        if (saved.status !== "ok" || !saved.value || request.signal.aborted || digestSfValue([call.kind, call.binding]) !== binding || !await input.authorizeSelection(selection, call) || !await input.approveSelection(selection, call) || !await input.host.revalidate(call)) return { status: "unavailable" as const }
        return { status: "ok" as const }
      } catch { return { status: "unavailable" as const } }
    },
    /** Host-only lookup: the browser supplies neither this state nor an observation value. */
    async select(wanted: { caseRef: SfOutcomeSelection["caseRef"]; choiceId: string }, call: TrustedDomainContext): Promise<SfOutcomeSelection | undefined> {
      try {
        const request = input.host.requestFor(call)
        const binding = digestSfValue([call.kind, call.binding])
        if (!request || request.signal.aborted || !await input.host.revalidate(call)) return undefined
        const read = () => input.state.read(request, "preferences", (state, authority) => authority.principalRef === call.binding.principalRef && authority.accessRevision === call.binding.accessRevision && authority.policyVersion === call.binding.policyVersion ? state.preferences[key({ caseRef: wanted.caseRef, choiceId: wanted.choiceId }, call)] as StoredSelection | undefined : undefined)
        const first = await read()
        if (first.status !== "ok" || !first.value || first.value.schema !== "sf-memory-outcome-v1" || first.value.principalRef !== call.binding.principalRef || !validSelection(first.value.selection, call) || digestSfValue(first.value.selection.caseRef) !== digestSfValue(wanted.caseRef) || first.value.selection.choiceId !== wanted.choiceId) return undefined
        const current = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== wanted.caseRef.id || current.value.case.incarnation !== wanted.caseRef.incarnation || current.value.case.version !== wanted.caseRef.version || current.value.case.choices.filter((choice) => choice.id === wanted.choiceId && digestSfValue(choice) === first.value!.choiceDigest).length !== 1 || !await input.authorizeSelection(first.value.selection, call)) return undefined
        const again = await read()
        if (again.status !== "ok" || first.storageVersion !== again.storageVersion || digestSfValue(again.value) !== digestSfValue(first.value) || request.signal.aborted || digestSfValue([call.kind, call.binding]) !== binding || !await input.authorizeSelection(first.value.selection, call) || !await input.host.revalidate(call)) return undefined
        const latest = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
        if (latest.status !== "ok" || digestSfValue(latest.value.case) !== digestSfValue(current.value.case) || !await input.host.revalidate(call)) return undefined
        return structuredClone(first.value.selection)
      } catch { return undefined }
    },
  }
}

function key(selection: Pick<SfOutcomeSelection, "caseRef" | "choiceId">, call: TrustedDomainContext) {
  return `${SF_OUTCOME_SELECTION_PREFIX}${digestSfValue([call.binding.installationId, call.binding.projectId, call.binding.principalRef, selection.caseRef.id, selection.caseRef.incarnation, selection.choiceId])}`
}

function validSelection(selection: SfOutcomeSelection, call: TrustedDomainContext) {
  const evidence = selection.evidenceRefs
  if (!selection.caseRef.id.trim() || !selection.caseRef.incarnation.trim() || !Number.isSafeInteger(selection.caseRef.version) || selection.caseRef.version < 1 || !selection.choiceId.trim() || !selection.criterionRef.trim() || !selection.valueId.trim() || !isSfPeriod(selection.period) || evidence.length !== 1) return false
  const ref = evidence[0]!
  return ref.schema === "sf-evidence-v1" && ref.kind === "record" && !!ref.refId.trim() && ref.target.surface === "planner" && !!ref.target.recordType.trim() && !!ref.target.recordId.trim() && !!ref.target.incarnation.trim() && Number.isSafeInteger(ref.target.version) && ref.target.version > 0 && /^[a-f0-9]{64}$/.test(ref.target.projectionDigest) && Array.isArray(ref.target.fields) && ref.target.fields.length > 0 && ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref) && !!ref.target.period && isSfPeriod(ref.target.period) && ref.target.period.start <= selection.period.start && ref.target.period.end >= selection.period.end
}
