import { digestSfValue } from "../contracts/canonical.ts"
import type { DispatchSfCapability } from "../contracts/runtime.ts"
import type { CapabilityResult } from "../contracts/sf-execution.ts"

/** Shared final path for UI and native calls. Authority callbacks own both private registries. */
export const dispatchSfCapability: DispatchSfCapability = async (input) => {
  const reject = (reason: string, code: "invalid-binding" | "invalid-input" | "unavailable"): CapabilityResult => ({
    status: code === "unavailable" ? "unavailable" : "denied",
    reason,
    receipt: { kind: "unbound", operation: input.operation, code, at: new Date().toISOString() },
  })
  const matches = input.descriptors.filter((descriptor) => descriptor.id === input.operation)
  if (matches.length !== 1) return reject("operation-unavailable", "unavailable")
  const descriptor = matches[0]!
  if (!input.validateInput(descriptor, input.payload)) return reject("invalid-operation-input", "invalid-input")
  const payload = structuredClone(input.payload)
  const digest = digestSfValue(payload)
  if (!(await input.authority.validateDomainContext(input.context, input.operation, digest)))
    return reject("authority-unavailable", "invalid-binding")
  if (input.context.kind === "native" && !descriptor.grantProfiles.includes(input.context.binding.profileId))
    return reject("profile-not-granted", "invalid-binding")
  if (input.context.kind === "native" && input.context.binding.entryMode === "routine-result" &&
    (input.operation === "sf_routine_prepare" || input.operation === "sf_routine_run"))
    return reject("recursive-routine-denied", "invalid-binding")
  if (!(await input.authority.revalidateDomainContext(input.context))) return reject("authority-changed", "invalid-binding")
  const result = await descriptor.handler(payload, input.context)
  if (!(await input.authority.revalidateDomainContext(input.context))) return reject("authority-changed", "invalid-binding")
  if (!input.validateOutput(descriptor, result)) return reject("invalid-operation-output", "unavailable")
  if (result.status !== "ok") return {
    status: result.status, reason: result.reason,
    receipt: { kind: "unbound", operation: input.operation, code: result.status === "provider-conflict" ? "provider-conflict" : "unavailable", at: new Date().toISOString() },
  }
  const receipt = result.receipt
  const expected = input.authority.receiptFor(input.context, input.operation, digest, digestSfValue(result.result))
  if (!expected || expected.handlerExport !== descriptor.handlerExport || receipt.kind !== expected.kind || receipt.operation !== expected.operation ||
    receipt.handlerExport !== expected.handlerExport || receipt.inputDigest !== expected.inputDigest ||
    receipt.resultDigest !== expected.resultDigest || receipt.principalRef !== expected.principalRef ||
    receipt.accessRevision !== expected.accessRevision || receipt.callId !== expected.callId)
    return reject("invalid-receipt", "unavailable")
  if (receipt.kind === "native" && (expected.kind !== "native" || receipt.runId !== expected.runId ||
    receipt.nativeSessionId !== expected.nativeSessionId || receipt.providerGeneration !== expected.providerGeneration))
    return reject("invalid-receipt", "unavailable")
  if (receipt.kind === "ui" && (expected.kind !== "ui" || receipt.requestId !== expected.requestId))
    return reject("invalid-receipt", "unavailable")
  return result
}
