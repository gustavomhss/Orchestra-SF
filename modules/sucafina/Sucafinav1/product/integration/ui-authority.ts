import { types } from "node:util"
import { beginSfReadonlyDiagnostic, endSfReadonlyDiagnostic, countSfReadonlyDiagnostic } from "../portfolio/diagnostic-timing.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfBindingRegistry, SfDomainValidation } from "../contracts/runtime.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext, TrustedUiContext, TrustedUiLease } from "../contracts/sf-execution.ts"
import freeze from "../contracts/freeze-v1.json" with { type: "json" }

type UiIdentity = Pick<TrustedUiContext["binding"], "installationId" | "projectId" | "principalRef" | "policyVersion" | "accessRevision">
type UiAdmission = { request: Request; operation: string; inputDigest: string; commandId: string; expiresAt: number; consumed: boolean }
const identityFields = ["installationId", "projectId", "principalRef", "policyVersion", "accessRevision"] as const

export type SfUiContextIntegrity = Readonly<{ digest: string; current: () => boolean }>
type IntegrityDiagnosticSurface = "Root" | "Business" | "Other"

// These are structural observations of factory-owned immutable data, not grants.
// As with the existing canonical/readonly guards, module loading trusts the host's
// original intrinsics. Later replacements select the original digest path.
const ownDescriptor = Object.getOwnPropertyDescriptor
const ownKeys = Reflect.ownKeys
const prototypeOf = Object.getPrototypeOf
const extensible = Object.isExtensible
const owns = Object.hasOwn
const proxy = types.isProxy
const freezeObservation = Object.freeze
const objectPrototype = Object.prototype, arrayPrototype = Array.prototype, arraySpecies = Symbol.species
const immutableUiContexts = new WeakMap<object, object>()
const immutableUiContextFor = immutableUiContexts.get.bind(immutableUiContexts)
const rememberImmutableUiContext = immutableUiContexts.set.bind(immutableUiContexts)
const bindingFields = [...identityFields, "requestId", "expiresAt"] as const
const integrityPins: readonly (readonly [object, PropertyKey])[] = [
  [globalThis, "Object"], [globalThis, "Array"], [globalThis, "JSON"], [globalThis, "Bun"],
  [Object, "prototype"], [Object, "keys"], [Object, "getPrototypeOf"],
  [Array, "prototype"], [Array, "isArray"], [arrayPrototype, "map"], [arrayPrototype, "sort"],
  [arrayPrototype, "includes"], [arrayPrototype, "constructor"], [Array, arraySpecies],
  [JSON, "stringify"], [Bun, "CryptoHasher"], [Bun.CryptoHasher, "prototype"],
  [Bun.CryptoHasher.prototype, "update"], [Bun.CryptoHasher.prototype, "digest"],
]
const integrityDescriptors = integrityPins.map(([owner, key]) => ownDescriptor(owner, key))
function integrityEnvironmentRejected(reason: string, surface: IntegrityDiagnosticSurface, index?: number) {
  countSfReadonlyDiagnostic(index === undefined ? `ui-context.environment.${reason}` : `ui-context.environment.${reason}.pin.${index}`, surface)
  return false
}
function integrityEnvironmentCurrent(surface: IntegrityDiagnosticSurface) {
  if (prototypeOf(objectPrototype) !== null) return integrityEnvironmentRejected("object-prototype", surface)
  if (prototypeOf(arrayPrototype) !== objectPrototype) return integrityEnvironmentRejected("array-prototype", surface)
  if (ownDescriptor(objectPrototype, "toJSON")) return integrityEnvironmentRejected("object-toJSON", surface)
  if (ownDescriptor(arrayPrototype, "toJSON")) return integrityEnvironmentRejected("array-toJSON", surface)
  for (let index = 0; index < integrityPins.length; index++) {
    const pin = integrityPins[index]!, expected = integrityDescriptors[index]
    const actual = ownDescriptor(pin[0], pin[1])
    if (!actual) return integrityEnvironmentRejected("actual-descriptor-missing", surface, index)
    if (!expected) return integrityEnvironmentRejected("baseline-descriptor-missing", surface, index)
    if (actual.enumerable !== expected.enumerable || actual.configurable !== expected.configurable ||
        owns(actual, "value") !== owns(expected, "value")) return integrityEnvironmentRejected("descriptor-drift", surface, index)
    if (owns(expected, "value")) {
      if (actual.value !== expected.value || actual.writable !== expected.writable)
        return integrityEnvironmentRejected("value-drift", surface, index)
    } else {
      if (pin[1] !== arraySpecies) return integrityEnvironmentRejected("baseline-accessor", surface, index)
      if (actual.get !== expected.get || actual.set !== expected.set)
        return integrityEnvironmentRejected("accessor-drift", surface, index)
    }
  }
  countSfReadonlyDiagnostic("ui-context.environment.current", surface)
  return true
}
function immutableRecord(value: unknown, fields: readonly string[], strings = false) {
  if (!value || typeof value !== "object" || proxy(value) || prototypeOf(value) !== objectPrototype || extensible(value) ||
      ownKeys(value).length !== fields.length) return false
  for (let index = 0; index < fields.length; index++) {
    const descriptor = ownDescriptor(value, fields[index]!)
    if (!descriptor || !owns(descriptor, "value") || descriptor.writable !== false || descriptor.configurable !== false ||
        (strings && typeof descriptor.value !== "string")) return false
  }
  return true
}
function rememberUiContextIntegrity(context: TrustedUiContext) {
  // Inspect the actual returned objects after the factory's asynchronous work.
  // A replaced freeze, accessor, extra key, symbol or nested value stays legacy.
  countSfReadonlyDiagnostic("ui-context.mint.proof-attempt")
  if (immutableRecord(context, ["kind", "binding", "lease"]) && context.kind === "ui" &&
      immutableRecord(context.binding, bindingFields, true)) {
    rememberImmutableUiContext(context, {})
    countSfReadonlyDiagnostic("ui-context.mint.registered")
  } else countSfReadonlyDiagnostic("ui-context.mint.ineligible")
}
function immutableUiContextIdentity(context: TrustedDomainContext, surface: IntegrityDiagnosticSurface) {
  const identity = immutableUiContextFor(context)
  if (!identity) {
    countSfReadonlyDiagnostic("ui-context.provenance.miss", surface)
    return undefined
  }
  countSfReadonlyDiagnostic("ui-context.provenance.hit", surface)
  return integrityEnvironmentCurrent(surface) ? identity : undefined
}

/** Capture integrity only; callers must retain every live authority observation. */
export function observeSfUiContextIntegrity(context: TrustedDomainContext,
  captured?: Pick<TrustedDomainContext, "binding">, surface: IntegrityDiagnosticSurface = "Other"): SfUiContextIntegrity {
  // Keep the original argument reads before the hasher constructor, including
  // getters on opaque/native contexts. Eligibility inspection invokes no getter.
  const value = [context.kind, captured ? captured.binding : context.binding]
  const measured = beginSfReadonlyDiagnostic("ui-context.capture", surface)
  try {
    const eligible = immutableUiContextIdentity(context, surface)
    const before = eligible && value[1] === context.binding ? eligible : undefined
    countSfReadonlyDiagnostic(before ? "ui-context.capture.pre-eligible" :
      eligible ? "ui-context.capture.binding-mismatch" : "ui-context.capture.pre-unavailable", surface)
    const digest = digestSfValue(value)
    const after = immutableUiContextIdentity(context, surface)
    countSfReadonlyDiagnostic(after ? "ui-context.capture.post-eligible" : "ui-context.capture.post-unavailable", surface)
    const identity = before && before === after ? before : undefined
    countSfReadonlyDiagnostic(identity ? "ui-context.capture.attested" : "ui-context.capture.unattested", surface)
    return freezeObservation({ digest, current: () => {
      const actual = [context.kind, context.binding]
      const currentMeasured = beginSfReadonlyDiagnostic("ui-context.current", surface)
      try {
        // An observation captured under a hook never adopts a later attestation.
        if (identity && immutableUiContextIdentity(context, surface) === identity) {
          countSfReadonlyDiagnostic("ui-context.current.fast", surface)
          return true
        }
        countSfReadonlyDiagnostic(identity ? "ui-context.current.fallback.live-proof-unavailable" :
          "ui-context.current.fallback.capture-unattested", surface)
        return digestSfValue(actual) === digest
      } finally { endSfReadonlyDiagnostic(currentMeasured) }
    } })
  } finally { endSfReadonlyDiagnostic(measured) }
}

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
  const current = (context: TrustedUiContext) => {
    const admission = admissions.get(context)
    if (admission && !admission.request.signal.aborted && input.now() < admission.expiresAt) return admission
    admissions.delete(context)
    return undefined
  }
  const revalidate = async (context: TrustedUiContext) => {
    const admission = current(context)
    if (!admission) return false
    const identity = await input.authorize(admission.request, admission.operation, admission.inputDigest)
    const valid = !!current(context) && !!identity && Object.keys(identity).length === identityFields.length &&
      identityFields.every((key) => context.binding[key] === identity[key])
    if (!valid) admissions.delete(context)
    return valid
  }
  return {
    async admit(request: Request, operation: string, inputDigest: string): Promise<PortResult<TrustedUiContext>> {
      if ((!privateCommands.has(operation) && freeze.operations.filter((entry) => entry.operation === operation).length !== 1) || !/^[a-f0-9]{64}$/.test(inputDigest))
        return { status: "denied", reason: "invalid-ui-operation" }
      const identity = await input.authorize(request, operation, inputDigest)
      if (request.signal.aborted || !identity || Object.keys(identity).length !== identityFields.length || identityFields.some((key) => typeof identity[key] !== "string" || !identity[key].trim()))
        return { status: "denied", reason: "ui-authority-unavailable" }
      const requestId = input.createId()
      // The host resolves a persisted command intention; a transport retry gets another requestId.
      const commandId = await input.commandIdentity(request, operation, inputDigest)
      const expiresAt = input.now() + 5 * 60 * 1000
      if (!requestId.trim() || !commandId?.trim() || !Number.isFinite(expiresAt)) return { status: "unavailable", reason: "ui-identity-unavailable" }
      const context: TrustedUiContext = Object.freeze({
        kind: "ui", binding: Object.freeze({ ...identity, requestId, expiresAt: new Date(expiresAt).toISOString() }),
        lease: Object.freeze({}) as TrustedUiLease,
      })
      admissions.set(context, { request, operation, inputDigest, commandId, expiresAt, consumed: false })
      if (!await revalidate(context)) {
        admissions.delete(context)
        return { status: "denied", reason: "ui-authority-changed" }
      }
      rememberUiContextIntegrity(context)
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
      const admission = current(context)
      return !!admission?.consumed && admission.operation === operation && admission.inputDigest === inputDigest
    },
    requestFor(context: TrustedUiContext) {
      const admission = current(context)
      return admission?.consumed ? admission.request : undefined
    },
    operationIdentity(context: TrustedUiContext) {
      const admission = current(context)
      return admission?.consumed ? admission.commandId : undefined
    },
    revalidate,
    receiptFor(context: TrustedUiContext, operation: string, inputDigest: string, resultDigest?: string): BoundCapabilityReceipt | undefined {
      const admission = current(context)
      const routes = freeze.operations.filter((entry) => entry.operation === operation)
      if (!admission?.consumed || admission.operation !== operation || admission.inputDigest !== inputDigest || routes.length !== 1 || (resultDigest !== undefined && !/^[a-f0-9]{64}$/.test(resultDigest))) return undefined
      return {
        kind: "ui", operation, handlerExport: routes[0]!.handlerExport, inputDigest,
        ...(resultDigest === undefined ? {} : { resultDigest }), principalRef: context.binding.principalRef,
        callId: context.binding.requestId, requestId: context.binding.requestId,
        accessRevision: context.binding.accessRevision, at: new Date(input.now()).toISOString(),
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
