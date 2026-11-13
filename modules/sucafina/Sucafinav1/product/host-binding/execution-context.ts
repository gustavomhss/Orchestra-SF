import { digestSfValue } from "../contracts/canonical.ts"
import { validSfSelection } from "./resident-agents.ts"
import routes from "../contracts/normative-contracts.json"
import freeze from "../contracts/freeze-v1.json"
import type { BindSfExecution, CreateSfExecutionBindingRegistry, SfNativeAdmission } from "../contracts/runtime.ts"
import type { TrustedCallContext, TrustedCallLease, TrustedExecutionBinding } from "../contracts/sf-execution.ts"

const nativeBindingMark = Symbol("sf-native-binding")

/** The Request and admission are held only in the registry, never in a binding or model argument. */
export const createSfExecutionBindingRegistry: CreateSfExecutionBindingRegistry = (input) => {
  const sessions = new Map<string, TrustedExecutionBinding>()
  const bindings = new WeakMap<TrustedExecutionBinding, { admission: SfNativeAdmission; revoked: boolean; issuedCalls: Set<string> }>()
  const leases = new WeakMap<TrustedCallLease, { binding: TrustedExecutionBinding; operation: string; digest: string; assistantMessageID: string; toolCallID: string; callKey: string; expires: number; used: boolean; finished: boolean }>()
  const invalidGenerations = new Set<number>()
  const current = (binding: TrustedExecutionBinding) => {
    const state = bindings.get(binding)
    return !!state && !state.revoked && sessions.get(binding.nativeSessionId) === binding &&
      !state.admission.request.signal.aborted && !invalidGenerations.has(binding.providerGeneration) &&
      Date.now() < Date.parse(binding.expiresAt)
  }
  const active = (context: TrustedCallContext) => {
    const lease = leases.get(context.lease)
    return context.kind === "native" && !!lease && lease.binding === context.binding && !lease.finished &&
      performance.now() < lease.expires && current(context.binding)
  }
  return {
    bind: async (admission) => {
      const saved = Object.freeze({
        ...freezeAdmission(structuredClone({ selected: admission.selected, sessionID: admission.sessionID, runId: admission.runId,
          caseRef: admission.caseRef, profile: admission.profile, manifestDigest: admission.manifestDigest,
          skillReceipts: admission.skillReceipts, entryMode: admission.entryMode })),
        request: admission.request,
      })
      if (!validSfSelection(saved.selected) || digestSfValue(saved.selected.profile) !== digestSfValue(saved.profile) ||
        saved.selected.manifestDigest !== saved.manifestDigest || sessions.has(saved.sessionID) || saved.request.signal.aborted || !saved.runId ||
        !saved.caseRef.id || !saved.caseRef.incarnation || !Number.isSafeInteger(saved.caseRef.version) ||
        !saved.skillReceipts.length) return { status: "denied", reason: "invalid-native-admission" }
      if (saved.skillReceipts.some((receipt) => receipt.runId !== saved.runId || receipt.nativeSessionId !== saved.sessionID ||
        receipt.profileId !== saved.profile.id || receipt.profileVersion !== saved.profile.version || receipt.profileDigest !== saved.profile.sourceDigest ||
        receipt.manifestDigest !== saved.manifestDigest || !saved.selected.skills.some((skill) => skill.id === receipt.skillId &&
          skill.version === receipt.skillVersion && skill.sourceDigest === receipt.sourceDigest && skill.instructionsDigest === receipt.instructionsDigest) || !receipt.loadedMessageId))
        return { status: "denied", reason: "skill-receipt-mismatch" }
      const checked = await Promise.resolve().then(() => input.authenticateAndResolve(saved)).catch(() => undefined)
      if (!checked || !Number.isFinite(Date.parse(checked.expiresAt)) || Date.parse(checked.expiresAt) <= Date.now() ||
        invalidGenerations.has(checked.providerGeneration) || sessions.has(saved.sessionID) || saved.request.signal.aborted)
        return { status: "denied", reason: "native-authority-unavailable" }
      const binding = {
        [nativeBindingMark]: true as const,
        installationId: checked.installationId, hostId: checked.hostId, projectId: checked.projectId, locationId: checked.locationId,
        principalRef: checked.principalRef, policyVersion: checked.policyVersion, accessRevision: checked.accessRevision,
        providerGeneration: checked.providerGeneration, expiresAt: checked.expiresAt, nativeSessionId: saved.sessionID,
        runId: saved.runId, caseId: saved.caseRef.id, caseVersion: saved.caseRef.version,
        caseIncarnation: saved.caseRef.incarnation, profileId: saved.profile.id, profileVersion: saved.profile.version,
        manifestDigest: saved.manifestDigest, skillReceipts: saved.skillReceipts, entryMode: saved.entryMode,
      }
      assertNativeBinding(binding)
      Object.freeze(binding)
      if (!(await Promise.resolve().then(() => input.revalidateAdmission(saved, binding)).catch(() => false)) ||
        invalidGenerations.has(checked.providerGeneration) || sessions.has(saved.sessionID) || saved.request.signal.aborted || Date.now() >= Date.parse(checked.expiresAt))
        return { status: "denied", reason: "native-authority-changed" }
      bindings.set(binding, { admission: saved, revoked: false, issuedCalls: new Set() })
      sessions.set(binding.nativeSessionId, binding)
      return { status: "ok", value: binding }
    },
    lease: async (context, operation, digest) => {
      const binding = sessions.get(context.sessionID)
      if (!binding || !current(binding) || binding.profileId !== context.agent || !context.assistantMessageID || !context.toolCallID ||
        !/^[a-f0-9]{64}$/.test(digest)) return { status: "denied", reason: "native-context-unavailable" }
      const state = bindings.get(binding)!
      const granted = state.admission.selected.operationIds.includes(operation) && state.admission.profile.allowedOperations.includes(operation) && binding.skillReceipts.some((receipt) =>
        state.admission.selected.skills.some((skill) => skill.id === receipt.skillId && skill.allowedOperations.includes(operation)) && routes.resident.skills.some((skill) =>
          skill.id === receipt.skillId && skill.profiles.some((profile) => profile === binding.profileId) &&
          skill.allowed_operations.some((allowed) => allowed === operation)))
      if (!granted || (binding.entryMode === "routine-result" && (operation === "sf_routine_prepare" || operation === "sf_routine_run")))
        return { status: "denied", reason: "operation-not-granted" }
      if (!(await Promise.resolve().then(() => input.revalidateAdmission(state.admission, binding)).catch(() => false)) || !current(binding))
        return { status: "denied", reason: "native-authority-changed" }
      const callKey = JSON.stringify([context.sessionID, context.assistantMessageID, context.toolCallID])
      if (state.issuedCalls.has(callKey)) return { status: "denied", reason: "native-call-already-issued" }
      const lease = Object.freeze({}) as TrustedCallLease
      leases.set(lease, { binding, operation, digest, assistantMessageID: context.assistantMessageID, toolCallID: context.toolCallID, callKey, expires: performance.now() + 300_000, used: false, finished: false })
      return { status: "ok", value: Object.freeze({ kind: "native", binding, lease }) }
    },
    consume: (context, operation, digest) => {
      const lease = leases.get(context.lease)
      if (!active(context) || !lease || lease.used || lease.operation !== operation || lease.digest !== digest) return false
      const state = bindings.get(context.binding)!
      if (state.issuedCalls.has(lease.callKey)) return false
      state.issuedCalls.add(lease.callKey)
      lease.used = true
      return true
    },
    requestFor: (context) => active(context) && leases.get(context.lease)?.used ? bindings.get(context.binding)?.admission.request : undefined,
    receiptFor: (context, operation, digest, resultDigest) => {
      const lease = leases.get(context.lease)
      const matches = freeze.operations.filter((item) => item.operation === operation)
      if (!active(context) || !lease?.used || lease.operation !== operation || lease.digest !== digest ||
        matches.length !== 1 || !matches[0]?.handlerExport || (resultDigest !== undefined && !/^[a-f0-9]{64}$/.test(resultDigest))) return undefined
      return { kind: "native", operation, handlerExport: matches[0].handlerExport, inputDigest: digest,
        ...(resultDigest === undefined ? {} : { resultDigest }), principalRef: context.binding.principalRef,
        callId: lease.toolCallID, accessRevision: context.binding.accessRevision, at: new Date().toISOString(),
        runId: context.binding.runId, nativeSessionId: context.binding.nativeSessionId, providerGeneration: context.binding.providerGeneration }
    },
    revalidate: async (context) => {
      if (!active(context)) return false
      const state = bindings.get(context.binding)!
      return (await Promise.resolve().then(() => input.revalidateAdmission(state.admission, context.binding)).catch(() => false)) && active(context)
    },
    finish: (context) => {
      const lease = leases.get(context.lease)
      if (lease && lease.binding === context.binding) lease.finished = true
    },
    invalidateGeneration: (generation) => { invalidGenerations.add(generation) },
    revoke: (binding) => {
      const state = bindings.get(binding)
      if (!state) return
      state.revoked = true
      if (sessions.get(binding.nativeSessionId) === binding) sessions.delete(binding.nativeSessionId)
    },
  }
}

export const bindSfExecution: BindSfExecution = (input) => input.registry.bind(input.admission)

function freezeAdmission<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freezeAdmission)
  return Object.freeze(value)
}

function assertNativeBinding<T extends { readonly [nativeBindingMark]: true }>(binding: T): asserts binding is T & TrustedExecutionBinding {
  if (binding[nativeBindingMark] !== true) throw new Error("invalid-native-binding")
}
