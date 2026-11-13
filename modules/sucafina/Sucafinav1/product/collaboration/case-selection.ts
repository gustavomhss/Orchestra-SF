import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort, SfProductState, SfStateAuthority } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CollaborationHumanAuthority } from "./human.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { createCollaborationAuthority } from "./authority.ts"
import type { WorkSelectionPort } from "./selection.ts"
import type { createCollaborationReissuer } from "./reissue.ts"

type SelectionDraft = { caseRef: string; period: Period; sourceRefs: readonly BusinessEvidenceRef[]; procurementSelectionRef?: string }
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }
type Stored = { id: string; principalRef: string; caseRef: string; caseIdentity: { id: string; incarnation: string; version: number }; period: Period; sourceRefs: readonly BusinessEvidenceRef[]; procurementSelectionRef?: string }
const prefix = "sf:case-work-selection:"

/** A user selects a real case and current sources; this private association is not an authority grant. */
export function createCaseWorkSelection(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  state: SfProductStatePort
  cases: Pick<DecisionCasePort, "read">
  authority: ReturnType<typeof createCollaborationAuthority>
  human: CollaborationHumanAuthority
  fence: CollaborationMutationFence
  fallback: WorkSelectionPort
  reissue?: ReturnType<typeof createCollaborationReissuer>
  target: { ref: string; incarnation: string }
  caseSelectionWrites: WeakSet<object>
  createId: () => string
}) {
  const sources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext): Promise<readonly BusinessEvidenceRef[] | undefined> => {
    if (!refs.length || await input.authority.sources(refs, context)) return refs
    if (!input.reissue || refs.some((ref) => !ref || typeof ref !== "object" || ref.kind !== "record")) return undefined
    const issued = await Promise.all(refs.map((ref) => input.reissue!(ref as Extract<BusinessEvidenceRef, { kind: "record" }>, context)))
    if (issued.some((entry) => entry.status !== "ok")) return undefined
    return issued.flatMap((entry) => entry.status === "ok" ? [entry.value] : [])
  }
  const current = async (stored: Stored, context: TrustedDomainContext) => {
    if (stored.principalRef !== context.binding.principalRef || !await sources(stored.sourceRefs, context)) return false
    const result = await input.cases.read({ caseRef: stored.caseRef }, context)
    return result.status === "ok" && digestSfValue({ id: result.value.case.id, incarnation: result.value.case.incarnation, version: result.value.case.version }) === digestSfValue(stored.caseIdentity) && stored.period.start >= result.value.case.horizon.start && stored.period.end <= result.value.case.horizon.end && await input.host.revalidate(context)
  }
  const load = async (selectionRef: string, period: Period, context: TrustedDomainContext): Promise<PortResult<Stored>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-unavailable" }
    const result = await input.state.read(request, "preferences", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.preferences[selectionRef] as Stored | undefined : undefined)
    if (result.status !== "ok" || !result.value || result.value.id !== selectionRef || digestSfValue(result.value.period) !== digestSfValue(period) || !await current(result.value, context)) return { status: "unavailable", reason: "selection-unavailable" }
    const again = await input.state.read(request, "preferences", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.preferences[selectionRef] : undefined)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(result.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "selection-changed" }
    return { status: "ok", value: result.value }
  }
  const port: WorkSelectionPort = {
    resolve: async (selectionRef, period, context) => {
      if (!selectionRef.startsWith(prefix)) return input.fallback.resolve(selectionRef, period, context)
      const found = await load(selectionRef, period, context)
      if (found.status !== "ok") return found
      if (found.value.procurementSelectionRef) {
        const procurement = await input.fallback.resolve(found.value.procurementSelectionRef, period, context)
        if (procurement.status !== "ok") return procurement
      }
      return { status: "ok", value: { selectionRef, period, token: found.value, procurement: found.value.procurementSelectionRef ? { state: "selected", selectionRef: found.value.procurementSelectionRef } : { state: "not-in-scope" } } }
    },
    contains: async (selection, refs, context) => {
      if (!selection.selectionRef.startsWith(prefix)) return input.fallback.contains(selection, refs, context)
      const found = await load(selection.selectionRef, selection.period, context)
      if (found.status !== "ok" || digestSfValue(found.value) !== digestSfValue(selection.token)) return { status: "unavailable", reason: "selection-unavailable" }
      if (!refs.length || !await input.authority.sources(refs, context)) return { status: "unavailable", reason: "selection-source-unavailable" }
      const selectedSources = await sources(found.value.sourceRefs, context)
      if (!selectedSources) return { status: "unavailable", reason: "selection-source-unavailable" }
      if (refs.some((ref) => selectedSources.some((source) => source.refDigest === ref.refDigest))) return { status: "ok", value: true }
      if (found.value.procurementSelectionRef) {
        const procurement = await input.fallback.resolve(found.value.procurementSelectionRef, selection.period, context)
        if (procurement.status !== "ok") return procurement
        return input.fallback.contains(procurement.value, refs, context)
      }
      return { status: "ok", value: false }
    },
  }
  return {
    port,
    list: async (caseRef: string, context: TrustedDomainContext): Promise<PortResult<readonly { selectionRef: string; period: Period; state: "active" | "unavailable" }[]>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-unavailable" }
      const currentCase = await input.cases.read({ caseRef }, context)
      if (currentCase.status !== "ok") return currentCase
      const read = await input.state.read(request, "preferences", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.preferences).flatMap(([id, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return []
        const stored = value as Stored
        return id.startsWith(prefix) && stored.id === id && stored.principalRef === context.binding.principalRef && stored.caseIdentity?.id === currentCase.value.case.id && stored.caseIdentity?.incarnation === currentCase.value.case.incarnation && isSfPeriod(stored.period) && Array.isArray(stored.sourceRefs) ? [stored] : []
      }) : undefined)
      if (read.status !== "ok" || !read.value) return { status: "unavailable", reason: "selection-unavailable" }
      const value = await Promise.all(read.value.map(async (stored) => ({
        selectionRef: stored.id,
        period: stored.period,
        state: await current(stored, context) ? "active" as const : "unavailable" as const,
      })))
      const preferencesAgain = await input.state.read(request, "preferences", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.fromEntries(read.value!.map((stored) => [stored.id, state.preferences[stored.id]])) : undefined)
      if (preferencesAgain.status !== "ok" || !preferencesAgain.value || preferencesAgain.storageVersion !== read.storageVersion || digestSfValue(preferencesAgain.value) !== digestSfValue(Object.fromEntries(read.value.map((stored) => [stored.id, stored]))) || !await input.host.revalidate(context)) return { status: "stale", reason: "selection-changed" }
      const again = await input.cases.read({ caseRef }, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(currentCase.value.case) || !await input.host.revalidate(context)) return { status: "stale", reason: "case-changed" }
      return { status: "ok", value }
    },
    storageVersion: async (context: TrustedDomainContext): Promise<PortResult<number>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-unavailable" }
      const state = await input.state.read(request, "preferences", (_value, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
      if (state.status === "unavailable" && state.reason === "product-state-uninitialized" && await input.host.revalidate(context)) return { status: "ok", value: 0 }
      if (state.status !== "ok" || !state.value || !await input.host.revalidate(context)) return { status: "unavailable", reason: "selection-unavailable" }
      return { status: "ok", value: state.storageVersion }
    },
    resolveCase: async (selectionRef: string, period: Period, context: TrustedDomainContext) => {
      if (!selectionRef.startsWith(prefix)) return { status: "unavailable" as const }
      const result = await load(selectionRef, period, context)
      return result.status === "ok" ? { status: "ok" as const, caseRef: result.value.caseIdentity } : { status: "unavailable" as const }
    },
    create: async (draft: SelectionDraft, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<{ selectionRef: string }>> => {
      if (context.kind !== "ui" || !draft || typeof draft.caseRef !== "string" || !draft.caseRef.trim() || !isSfPeriod(draft.period) || !Array.isArray(draft.sourceRefs) || !mutation || !Number.isSafeInteger(mutation.expectedStorageVersion) || mutation.expectedStorageVersion < 0 || typeof mutation.idempotencyKey !== "string" || !mutation.idempotencyKey.trim() || (draft.procurementSelectionRef !== undefined && (typeof draft.procurementSelectionRef !== "string" || !draft.procurementSelectionRef.trim()))) return { status: "needs-input", reason: "invalid-selection" }
      const selected = structuredClone({ draft, mutation })
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.selection.create", selected) || !await input.host.revalidate(context)) return { status: "denied", reason: "selection-unavailable" }
      const result = await input.cases.read({ caseRef: selected.draft.caseRef }, context)
      if (result.status !== "ok") return result
      const stored: Stored = { id: `${prefix}${input.createId()}`, principalRef: context.binding.principalRef, caseRef: selected.draft.caseRef, caseIdentity: { id: result.value.case.id, incarnation: result.value.case.incarnation, version: result.value.case.version }, period: selected.draft.period, sourceRefs: selected.draft.sourceRefs, ...(selected.draft.procurementSelectionRef ? { procurementSelectionRef: selected.draft.procurementSelectionRef } : {}) }
      if (stored.id === prefix || (stored.sourceRefs.length > 0 && !await input.authority.sources(stored.sourceRefs, context)) || !await current(stored, context)) return { status: "unavailable", reason: "selection-unavailable" }
      if (stored.procurementSelectionRef && (await input.fallback.resolve(stored.procurementSelectionRef, stored.period, context)).status !== "ok") return { status: "unavailable", reason: "selection-unavailable" }
      const cases = await input.state.read(request, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.cases[stored.caseIdentity.id] : undefined)
      if (cases.status !== "ok" || !cases.value || cases.value.incarnation !== stored.caseIdentity.incarnation || cases.value.version !== stored.caseIdentity.version) return { status: "unavailable", reason: "selection-unavailable" }
      const fence = await input.fence.prepare(() => current(stored, context))
      if (!fence) return { status: "unavailable", reason: "selection-unavailable" }
      const work = async (state: SfProductState, authority: SfStateAuthority) => {
        const live = state.cases[stored.caseIdentity.id]
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !live || live.id !== stored.caseIdentity.id || live.incarnation !== stored.caseIdentity.incarnation || live.version !== stored.caseIdentity.version || !await input.human.authorize(context, "collaboration.selection.create", selected) || !input.fence.check(fence) || state.preferences[stored.id]) return { commit: false, value: "" }
        state.preferences[stored.id] = stored
        return { commit: true, value: stored.id }
      }
      input.caseSelectionWrites.add(work)
      const saved = await input.state.transaction(request, { namespace: "preferences", ...selected.mutation, sourceFence: "all", checkNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }], commandDigest: digestSfValue(selected.draft), targetRef: input.target.ref, targetIncarnation: input.target.incarnation }, work).finally(() => input.caseSelectionWrites.delete(work))
      if (saved.status === "preview") return { status: "conflict", reason: "selection-not-committed" }
      if (saved.status !== "ok" || !saved.value) return { status: "unavailable", reason: "selection-unavailable" }
      const verified = await load(saved.value, stored.period, context)
      if (verified.status !== "ok") return verified
      return { status: "ok", value: { selectionRef: saved.value } }
    },
  }
}
