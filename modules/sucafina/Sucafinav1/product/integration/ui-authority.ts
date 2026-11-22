import type { PortResult } from "../contracts/ports.ts"
import type { SfBindingRegistry, SfDomainValidation } from "../contracts/runtime.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext, TrustedUiContext, TrustedUiLease } from "../contracts/sf-execution.ts"
import freeze from "../contracts/freeze-v1.json" with { type: "json" }
import { sfHumanActions, sfHumanReadActions } from "./human-authority.ts"

type UiIdentity = Pick<TrustedUiContext["binding"], "installationId" | "projectId" | "principalRef" | "policyVersion" | "accessRevision">
type UiAdmission = { request: Request; operation: string; inputDigest: string; commandId: string; expiresAt: number; expired: boolean; consumed: boolean; renewable: boolean }
const identityFields = ["installationId", "projectId", "principalRef", "policyVersion", "accessRevision"] as const
const ttl = 5 * 60 * 1000
const validTime = (at: number) => Number.isFinite(new Date(at).getTime())

/** UI admission retains the authenticated Request privately; serialized objects never recover a lease. */
export function createSfUiAuthority(input: {
  authorize: (request: Request, operation: string, inputDigest: string) => Promise<UiIdentity | undefined>
  commandIdentity: (request: Request, operation: string, inputDigest: string) => Promise<string | undefined>
  createId: () => string
  now: () => number
  privateCommands?: readonly string[]
}) {
  const privateCommands = new Set(input.privateCommands)
  const admissions = new WeakMap<TrustedUiContext, UiAdmission>()
  const current = (context: TrustedUiContext, at = input.now(), retainExpiredCommand = false) => {
    const admission = admissions.get(context)
    if (!admission) return undefined
    if (!admission.request.signal.aborted && validTime(at)) {
      // Once observed, expiry survives a clock rollback until live reauthorization.
      if (at >= admission.expiresAt) admission.expired = true
      if (!admission.expired) return admission
      // A consumed command can retain its private identity while awaiting live reauthorization.
      if (admission.consumed && admission.renewable) return retainExpiredCommand ? admission : undefined
    }
    admissions.delete(context)
    return undefined
  }
  const revalidate = async (context: TrustedUiContext) => {
    const admission = current(context, input.now(), true)
    if (!admission) return false
    const identity = await input.authorize(admission.request, admission.operation, admission.inputDigest)
    const at = input.now()
    const valid = current(context, at, true) === admission && !!identity && Object.keys(identity).length === identityFields.length &&
      identityFields.every((key) => context.binding[key] === identity[key])
    if (!valid) admissions.delete(context)
    if (!valid) return false
    if (admission.expired) {
      const expiresAt = at + ttl
      if (!validTime(expiresAt)) {
        admissions.delete(context)
        return false
      }
      admission.expiresAt = expiresAt
      admission.expired = false
    }
    return true
  }
  return {
    async admit(request: Request, operation: string, inputDigest: string): Promise<PortResult<TrustedUiContext>> {
      const routes = freeze.operations.filter((entry) => entry.operation === operation)
      if ((!privateCommands.has(operation) && routes.length !== 1) || !/^[a-f0-9]{64}$/.test(inputDigest))
        return { status: "denied", reason: "invalid-ui-operation" }
      const identity = await input.authorize(request, operation, inputDigest)
      if (request.signal.aborted || !identity || Object.keys(identity).length !== identityFields.length || identityFields.some((key) => typeof identity[key] !== "string" || !identity[key].trim()))
        return { status: "denied", reason: "ui-authority-unavailable" }
      const requestId = input.createId()
      // The host resolves a persisted command intention; a transport retry gets another requestId.
      const commandId = await input.commandIdentity(request, operation, inputDigest)
      const at = input.now()
      const expiresAt = at + ttl
      if (!requestId.trim() || !commandId?.trim() || !validTime(at) || !validTime(expiresAt)) return { status: "unavailable", reason: "ui-identity-unavailable" }
      const renewable = request.method === "POST" && (operation.startsWith("sf-human:")
        ? sfHumanActions.some((action) => operation === "sf-human:" + action) &&
          !sfHumanReadActions.some((action) => operation === "sf-human:" + action)
        : routes.length === 1 && routes[0]!.mode !== "read")
      const context: TrustedUiContext = Object.freeze({
        kind: "ui", binding: Object.freeze({ ...identity, requestId, expiresAt: new Date(expiresAt).toISOString() }),
        lease: Object.freeze({}) as TrustedUiLease,
      })
      admissions.set(context, { request, operation, inputDigest, commandId, expiresAt, expired: false, consumed: false, renewable })
      if (!await revalidate(context)) {
        admissions.delete(context)
        return { status: "denied", reason: "ui-authority-changed" }
      }
      return { status: "ok", value: context }
    },
    async validate(context: TrustedUiContext, operation: string, inputDigest: string) {
      const admission = current(context)
      if (!admission || admission.consumed || admission.operation !== operation || admission.inputDigest !== inputDigest || !await revalidate(context)) return false
      // Recheck after the asynchronous authorization boundary: competing dispatches consume once.
      if (!current(context) || admission.consumed) return false
      admission.consumed = true
      return true
    },
    matchesIntent(context: TrustedUiContext, operation: string, inputDigest: string) {
      const admission = current(context, input.now(), true)
      return !!admission?.consumed && admission.operation === operation && admission.inputDigest === inputDigest
    },
    requestFor(context: TrustedUiContext) {
      const admission = current(context, input.now(), true)
      return admission?.consumed ? admission.request : undefined
    },
    operationIdentity(context: TrustedUiContext) {
      const admission = current(context, input.now(), true)
      return admission?.consumed ? admission.commandId : undefined
    },
    revalidate,
    receiptFor(context: TrustedUiContext, operation: string, inputDigest: string, resultDigest?: string): BoundCapabilityReceipt | undefined {
      const at = input.now()
      const admission = current(context, at)
      const routes = freeze.operations.filter((entry) => entry.operation === operation)
      if (!admission?.consumed || admission.operation !== operation || admission.inputDigest !== inputDigest || routes.length !== 1 || (resultDigest !== undefined && !/^[a-f0-9]{64}$/.test(resultDigest))) return undefined
      return {
        kind: "ui", operation, handlerExport: routes[0]!.handlerExport, inputDigest,
        ...(resultDigest === undefined ? {} : { resultDigest }), principalRef: context.binding.principalRef,
        callId: context.binding.requestId, requestId: context.binding.requestId,
        accessRevision: context.binding.accessRevision, at: new Date(at).toISOString(),
      }
    },
    finish(context: TrustedUiContext) { admissions.delete(context) },
  }
}

export function createSfDomainAuthority(input: { native: SfBindingRegistry; ui: ReturnType<typeof createSfUiAuthority> }) {
  const validation: SfDomainValidation = {
    validateDomainContext: async (context, operation, digest) => context.kind === "ui"
      ? input.ui.validate(context, operation, digest)
      : await input.native.revalidate(context) && input.native.consume(context, operation, digest),
    revalidateDomainContext: (context) => context.kind === "ui" ? input.ui.revalidate(context) : input.native.revalidate(context),
    receiptFor: (context, operation, digest, resultDigest) => context.kind === "ui"
      ? input.ui.receiptFor(context, operation, digest, resultDigest)
      : input.native.receiptFor(context, operation, digest, resultDigest),
  }
  return {
    ...validation,
    requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? input.ui.requestFor(context) : input.native.requestFor(context),
    finish: (context: TrustedDomainContext) => context.kind === "ui" ? input.ui.finish(context) : input.native.finish(context),
  }
}
