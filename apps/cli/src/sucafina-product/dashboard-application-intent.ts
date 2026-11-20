import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { AdmittedApply, PreparedApplyRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

export type DashboardRecoverRequest = PreparedApplyRequest & { purpose: "recover" }
type Intent = {
  schema: "sf-dashboard-application-intent-v1"
  original: AdmittedApply
  operationIdentity: string
  installationId: string
  projectId: string
  principalRef: string
  policyVersion: string
  accessRevision: string
  preparedBindingDigest: string
  changeDigest: string
  choiceDigest: string
  physicalIncarnation: string
}
type Captured = {
  decision: DecisionCase
  change: PreparedChange
  binding: unknown
  entries: readonly SfProductState["transactions"][string][]
}

/** The original reviewed command stays in protected C08 state. A browser only
 * retains its opaque selector and key; recovery never recreates a review proof.
 */
export function createSfDashboardApplicationIntents(authority: ReturnType<typeof createSfProductAuthority>) {
  const { state, host, human, ui } = authority
  const sameAuthority = (current: SfStateAuthority, context: TrustedDomainContext) =>
    current.principalRef === context.binding.principalRef &&
    current.policyVersion === context.binding.policyVersion && current.accessRevision === context.binding.accessRevision

  const capture = (stored: Readonly<SfProductState>, request: PreparedApplyRequest, context: TrustedDomainContext): Captured | undefined => {
    const decision = stored.cases[request.caseRef.id]
    const changes = decision?.preparedChanges.filter((item) => item.id === request.changeId && item.choiceId === request.choiceId)
    const change = changes?.[0]
    const binding = stored.preferences["sf:dashboard-host:prepared:" + request.changeId]
    const prepared = object(binding), command = object(prepared.command)
    if (!decision || decision.incarnation !== request.caseRef.incarnation || decision.version < request.caseRef.version ||
      !decision.participants.includes(context.binding.principalRef) || changes?.length !== 1 || !change ||
      change.target.surface !== "dashboard" || change.target.type !== "hotTopics" ||
      decision.choices.filter((choice) => choice.id === request.choiceId).length !== 1 ||
      prepared.schema !== "sf-dashboard-prepared-binding-v1" || prepared.changeId !== request.changeId ||
      prepared.choiceId !== request.choiceId || object(prepared.caseRef).id !== decision.id ||
      object(prepared.caseRef).incarnation !== decision.incarnation || prepared.principalRef !== context.binding.principalRef ||
      prepared.policyVersion !== context.binding.policyVersion || prepared.accessRevision !== context.binding.accessRevision ||
      prepared.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(prepared).filter(([name]) => name !== "recordDigest"))) ||
      digestSfValue(command) !== digestSfValue(change.operation) ||
      prepared.choiceDigest !== digestSfValue(decision.choices.find((choice) => choice.id === request.choiceId))) return undefined
    return { decision, change, binding, entries: intentEntries(stored, request) }
  }
  const physical = async (snapshot: Snapshot, selected: Captured, context: TrustedDomainContext) => {
    const source = host.requestFor(context)
    if (!source || source.signal.aborted) return undefined
    const target = selected.change.target
    const principal = await host.authenticate(source, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== context.binding.principalRef || !principal.canWrite ||
      !principal.roles.some((role) => role.surface === "dashboard" && (role.role === "admin" || role.role === "domain leader"))) return undefined
    const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive &&
      entry.incarnation === target.incarnation && entry.scope.recordType === target.type && entry.scope.recordId === target.id &&
      entry.scope.principalRef === context.binding.principalRef && entry.scope.policyVersion === context.binding.policyVersion &&
      entry.scope.accessRevision === context.binding.accessRevision)
    const current = snapshot.sfSources?.records[JSON.stringify([target.type, target.id])]
    return scopes.length === 1 && current?.alive && scopes[0]!.sourceIncarnation === current.incarnation ? current.incarnation : undefined
  }
  const material = (request: AdmittedApply, selected: Captured, physicalIncarnation: string, context: TrustedDomainContext, operationIdentity: string): Intent => ({
    schema: "sf-dashboard-application-intent-v1", original: structuredClone(request), operationIdentity,
    installationId: context.binding.installationId, projectId: context.binding.projectId,
    principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision,
    preparedBindingDigest: digestSfValue(selected.binding),
    changeDigest: digestSfValue({ ...selected.change, state: "planned", receipt: null }),
    choiceDigest: digestSfValue(selected.decision.choices.find((choice) => choice.id === request.choiceId)),
    physicalIncarnation,
  })
  const load = async (request: PreparedApplyRequest, context: TrustedDomainContext) => {
    const source = host.requestFor(context)
    if (!source || source.signal.aborted || !await host.revalidate(context)) return undefined
    // C08 must admit both protected namespaces; no root snapshot substitutes for grants.
    const cases = await state.read(source, "cases", (stored, current) => sameAuthority(current, context) ? capture(stored, request, context) : undefined)
    const preferences = await state.read(source, "preferences", (stored, current) => sameAuthority(current, context) ? capture(stored, request, context) : undefined)
    return cases.status === "ok" && cases.value && preferences.status === "ok" && preferences.value &&
      cases.incarnation === preferences.incarnation && cases.aggregateRevision === preferences.aggregateRevision &&
      digestSfValue(cases.value) === digestSfValue(preferences.value) && await host.revalidate(context)
      ? { selected: cases.value, storageVersion: cases.storageVersion, aggregateRevision: cases.aggregateRevision, incarnation: cases.incarnation } : undefined
  }

  const reserve = async (incoming: AdmittedApply, context: TrustedDomainContext): Promise<boolean> => {
    const request = structuredClone(incoming), source = host.requestFor(context), operation = ui.operationIdentity(context)
    if (context.kind !== "ui" || !source || !operation || !await human.authorize(context, "decisions.apply", request)) return false
    const loaded = await load(request, context)
    if (!loaded || loaded.selected.decision.version !== request.caseRef.version || loaded.selected.change.state !== "planned") return false
    const incarnation = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: await physical(snapshot, loaded.selected, context) }), { signal: source.signal })
    if (!incarnation) return false
    const record = material(request, loaded.selected, incarnation, context, operation)
    if (loaded.selected.entries.length) {
      return loaded.selected.entries.length === 1 && validEnvelope(loaded.selected.entries[0]!, loaded, record) &&
        !source.signal.aborted && await human.authorize(context, "decisions.apply", request) && await host.revalidate(context)
    }
    const saved = await state.transaction<Intent | null>(source, { namespace: "cases", expectedStorageVersion: loaded.storageVersion,
      targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, idempotencyKey: intentKey(request),
      commandDigest: digestSfValue(record) }, async (stored, current, snapshot) => {
      const selected = sameAuthority(current, context) ? capture(stored, request, context) : undefined
      if (!selected || selected.entries.length || digestSfValue(selected) !== digestSfValue(loaded.selected) ||
        await physical(snapshot, selected, context) !== incarnation || !await human.authorize(context, "decisions.apply", request) ||
        source.signal.aborted || host.requestFor(context) !== source) return { commit: false, value: null }
      return { commit: true, value: record }
    }).catch(() => undefined)
    if (saved?.status !== "ok" || !saved.value || digestSfValue(saved.value) !== digestSfValue(record)) return false
    const final = await load(request, context)
    return !!final && final.selected.entries.length === 1 && validEnvelope(final.selected.entries[0]!, final, record) &&
      digestSfValue(final.selected.decision) === digestSfValue(loaded.selected.decision) &&
      !source.signal.aborted && await human.authorize(context, "decisions.apply", request) && await host.revalidate(context)
  }

  const read = async (incoming: DashboardRecoverRequest, context: TrustedDomainContext): Promise<PortResult<AdmittedApply>> => {
    const request = structuredClone(incoming), source = host.requestFor(context), operation = ui.operationIdentity(context)
    const denied = { status: "denied" as const, reason: "dashboard-recovery-access-unavailable" }
    const unavailable = { status: "unavailable" as const, reason: "dashboard-original-intent-unavailable" }
    if (context.kind !== "ui" || !source || !operation || !await human.authorize(context, "decisions.apply", request)) return denied
    const loaded = await load(request, context)
    if (!loaded) return denied
    if (loaded.selected.entries.length !== 1) return unavailable
    const transaction = loaded.selected.entries[0]!, value = object(transaction.value), original = decodeOriginal(value.original)
    if (!original || digestSfValue({ caseRef: original.caseRef, choiceId: original.choiceId, changeId: original.changeId }) !==
      digestSfValue({ caseRef: request.caseRef, choiceId: request.choiceId, changeId: request.changeId }) || value.operationIdentity !== operation) return unavailable
    const incarnation = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: await physical(snapshot, loaded.selected, context) }), { signal: source.signal })
    if (!incarnation) return denied
    const expected = material(original, loaded.selected, incarnation, context, operation)
    if (!validEnvelope(transaction, loaded, expected)) return unavailable
    const final = await load(request, context)
    const physicalAgain = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: await physical(snapshot, loaded.selected, context) }), { signal: source.signal })
    if (!final || digestSfValue(final.selected) !== digestSfValue(loaded.selected) || physicalAgain !== incarnation ||
      !await human.authorize(context, "decisions.apply", request) || !await host.revalidate(context) ||
      source.signal.aborted || host.requestFor(context) !== source) return denied
    return { status: "ok", value: structuredClone(original) }
  }
  return { reserve, read }
}

function intentKey(request: PreparedApplyRequest) {
  return "sf:dashboard-application:" + digestSfValue({ caseId: request.caseRef.id, caseIncarnation: request.caseRef.incarnation,
    choiceId: request.choiceId, changeId: request.changeId })
}
function intentEntries(state: Readonly<SfProductState>, request: PreparedApplyRequest) {
  const key = intentKey(request)
  return Object.entries(state.transactions).filter(([identity, value]) =>
    identity === JSON.stringify([value.principalRef, "cases", request.caseRef.id, key])).map(([, value]) => value)
}
function validEnvelope(transaction: SfProductState["transactions"][string], current: { incarnation: string; storageVersion: number; aggregateRevision: number }, expected: Intent) {
  return transaction.namespace === "cases" && transaction.scopeDigest === digestSfValue(["cases"]) &&
    transaction.principalRef === expected.principalRef && transaction.targetRef === expected.original.caseRef.id &&
    transaction.targetIncarnation === expected.original.caseRef.incarnation && transaction.incarnation === current.incarnation &&
    Number.isSafeInteger(transaction.storageVersion) && transaction.storageVersion > 0 && transaction.storageVersion <= current.storageVersion &&
    Number.isSafeInteger(transaction.aggregateRevision) && transaction.aggregateRevision > 0 && transaction.aggregateRevision <= current.aggregateRevision &&
    transaction.commandDigest === digestSfValue(expected) && digestSfValue(transaction.value) === digestSfValue(expected)
}
function decodeOriginal(value: unknown): AdmittedApply | undefined {
  const candidate = object(value), ref = object(candidate.caseRef)
  if (Object.keys(candidate).sort().join(",") !== "caseRef,changeId,choiceId,reviewDigest" ||
    Object.keys(ref).sort().join(",") !== "id,incarnation,version" || typeof ref.id !== "string" || !ref.id ||
    typeof ref.incarnation !== "string" || !ref.incarnation || !Number.isSafeInteger(ref.version) || Number(ref.version) < 1 ||
    typeof candidate.changeId !== "string" || !candidate.changeId || typeof candidate.choiceId !== "string" || !candidate.choiceId ||
    typeof candidate.reviewDigest !== "string" || !/^[a-f0-9]{64}$/.test(candidate.reviewDigest)) return undefined
  return { caseRef: { id: ref.id, incarnation: ref.incarnation, version: Number(ref.version) },
    choiceId: candidate.choiceId, changeId: candidate.changeId, reviewDigest: candidate.reviewDigest }
}
