import routes from "../contracts/normative-contracts.json"
import freeze from "../contracts/freeze-v1.json"
import type { BindSfExecution, CreateSfExecutionBindingRegistry, SfNativeAdmission } from "../contracts/runtime.ts"
import type { TrustedCallContext, TrustedCallLease, TrustedExecutionBinding } from "../contracts/sf-execution.ts"

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
      if (sessions.has(admission.sessionID) || admission.request.signal.aborted || !admission.runId ||
        !admission.caseRef.id || !admission.caseRef.incarnation || !Number.isSafeInteger(admission.caseRef.version) ||
        !admission.skillReceipts.length) return { status: "denied", reason: "invalid-native-admission" }
      const checked = await Promise.resolve().then(() => input.authenticateAndResolve(admission)).catch(() => undefined)
      if (!checked || !Number.isFinite(Date.parse(checked.expiresAt)) || Date.parse(checked.expiresAt) <= Date.now() ||
        invalidGenerations.has(checked.providerGeneration) || sessions.has(admission.sessionID) || admission.request.signal.aborted)
        return { status: "denied", reason: "native-authority-unavailable" }
      const profile = structuredClone(admission.profile)
      Object.freeze(profile.allowedOperations)
      Object.freeze(profile.allowedSkills)
      Object.freeze(profile.outputTypes)
      Object.freeze(profile)
      const receipts = structuredClone(admission.skillReceipts)
      if (receipts.some((receipt) => receipt.runId !== admission.runId || receipt.nativeSessionId !== admission.sessionID ||
        receipt.profileId !== profile.id || receipt.profileVersion !== profile.version || receipt.profileDigest !== profile.sourceDigest ||
        receipt.manifestDigest !== admission.manifestDigest || !profile.allowedSkills.includes(receipt.skillId) || !receipt.loadedMessageId))
        return { status: "denied", reason: "skill-receipt-mismatch" }
      const binding = Object.freeze({
        installationId: checked.installationId, hostId: checked.hostId, projectId: checked.projectId, locationId: checked.locationId,
        principalRef: checked.principalRef, policyVersion: checked.policyVersion, accessRevision: checked.accessRevision,
        providerGeneration: checked.providerGeneration, expiresAt: checked.expiresAt, nativeSessionId: admission.sessionID,
        runId: admission.runId, caseId: admission.caseRef.id, caseVersion: admission.caseRef.version,
        caseIncarnation: admission.caseRef.incarnation, profileId: profile.id, profileVersion: profile.version,
        manifestDigest: admission.manifestDigest, skillReceipts: Object.freeze(receipts.map((receipt) => Object.freeze(receipt))),
        entryMode: admission.entryMode,
      }) as unknown as TrustedExecutionBinding
      const saved = Object.freeze({ ...admission, profile, skillReceipts: Object.freeze(receipts), caseRef: Object.freeze({ ...admission.caseRef }) })
      if (!(await Promise.resolve().then(() => input.revalidateAdmission(saved, binding)).catch(() => false)) || sessions.has(admission.sessionID) || admission.request.signal.aborted || Date.now() >= Date.parse(checked.expiresAt))
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
      const granted = state.admission.profile.allowedOperations.includes(operation) && binding.skillReceipts.some((receipt) =>
        state.admission.profile.allowedSkills.includes(receipt.skillId) && routes.resident.skills.some((skill) =>
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
