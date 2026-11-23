/** Tagged canonical bytes distinguish absent, null, zero and inherited value descriptors. */
import { sfCanonicalCloneTree } from "./canonical-clone.ts"
import { pulsePortfolioJscDiagnostic } from "./portfolio-jsc-pulse.ts"
import type { BusinessEvidenceRef } from "./business-context.ts"
import type { ContributionEnvelope } from "./resident-ai.ts"

const canonicalStringify = JSON.stringify


type SfCanonicalCaptureRuntime = Readonly<{
  isProxy(value: unknown): boolean
  current(): boolean
}>

type SfCanonicalProjectionRuntime = Readonly<{
  reject(value: unknown): boolean
  current(): boolean
}>
let originalProjectionRuntime: SfCanonicalProjectionRuntime | undefined

const captureDescriptor = Object.getOwnPropertyDescriptor
const captureOwnKeys = Reflect.ownKeys
const capturePrototype = Object.getPrototypeOf
const captureOwn = Object.hasOwn
const captureSameValue = Object.is
const captureFreeze = Object.freeze
const captureDescriptorFields = ["configurable", "enumerable", "value", "writable", "get", "set"] as const

function sameCaptureDescriptor(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined) {
  if (!left || !right) return left === right
  for (let index = 0; index < captureDescriptorFields.length; index++) {
    const field = captureDescriptorFields[index]!
    if (captureOwn(left, field) !== captureOwn(right, field) ||
      captureOwn(left, field) && !captureSameValue(left[field], right[field])) return false
  }
  return true
}

/** This anchor belongs to the original canonical module bootstrap. It detects
 * changes after that bootstrap, including changes before a consumer is loaded.
 * It does not attest a runtime already modified before this module initialized.
 * Missing backend primitives permanently retain the original eager digest. */
function initializeCaptureRuntime(): SfCanonicalCaptureRuntime | undefined {
  try {
    if (typeof Bun === "undefined" || typeof process === "undefined") return undefined
    const objectPrototype = Object.prototype, arrayPrototype = Array.prototype
    if (capturePrototype(objectPrototype) !== null || capturePrototype(arrayPrototype) !== objectPrototype ||
      captureDescriptor(objectPrototype, "toJSON") || captureDescriptor(arrayPrototype, "toJSON")) return undefined
    const loader = captureDescriptor(process, "getBuiltinModule")
    if (!loader || !captureOwn(loader, "value") || typeof loader.value !== "function") return undefined
    // Optional lookup for this capture proof; a missing or accessor loader keeps it unavailable.
    const proxyTypes: unknown = process.getBuiltinModule("node:util/types")
    if (!proxyTypes || typeof proxyTypes !== "object") return undefined
    const proxy = captureDescriptor(proxyTypes, "isProxy")
    if (!proxy || !captureOwn(proxy, "value") || typeof proxy.value !== "function") return undefined
    const hashConstructor = Bun.CryptoHasher, hashPrototype = hashConstructor?.prototype
    if (!hashPrototype) return undefined
    const hashParent = capturePrototype(hashPrototype)
    const update = captureDescriptor(hashPrototype, "update"), digest = captureDescriptor(hashPrototype, "digest")
    if (typeof update?.value !== "function" || typeof digest?.value !== "function") return undefined

    const keys: readonly (readonly [object, PropertyKey])[] = [
      [globalThis, "globalThis"], [globalThis, "Object"], [globalThis, "Array"], [globalThis, "JSON"],
      [globalThis, "Number"], [globalThis, "Reflect"], [globalThis, "WeakMap"], [globalThis, "WeakSet"],
      [globalThis, "Symbol"], [globalThis, "Bun"], [globalThis, "process"],
      [Object, "prototype"], [Object, "getOwnPropertyDescriptor"], [Object, "getOwnPropertyDescriptors"],
      [Object, "getPrototypeOf"], [Object, "hasOwn"], [Object, "keys"], [Object, "is"],
      [Object, "defineProperty"], [Object, "create"], [Object, "freeze"],
      [Array, "prototype"], [Array, "isArray"], [Array, Symbol.species],
      [Symbol, "species"], [Number, "isFinite"], [JSON, "stringify"], [Reflect, "ownKeys"],
      [WeakMap, "prototype"], [WeakMap.prototype, "get"], [WeakMap.prototype, "set"],
      [WeakSet, "prototype"], [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
      [process, "getBuiltinModule"], [proxyTypes, "isProxy"],
      [Bun, "CryptoHasher"], [hashConstructor, "prototype"], [hashPrototype, "update"], [hashPrototype, "digest"],
    ]
    const pins: { owner: object; key: PropertyKey; expected: PropertyDescriptor }[] = []
    for (let index = 0; index < keys.length; index++) {
      const [owner, key] = keys[index]!, expected = captureDescriptor(owner, key)
      if (!expected) return undefined
      pins[index] = { owner, key, expected }
    }
    const prototypes: { owner: object; fields: { key: PropertyKey; expected: PropertyDescriptor }[] }[] = []
    for (const owner of [objectPrototype, arrayPrototype]) {
      const names = captureOwnKeys(owner), fields: { key: PropertyKey; expected: PropertyDescriptor }[] = []
      for (let index = 0; index < names.length; index++) {
        const key = names[index]!, expected = captureDescriptor(owner, key)
        if (!expected) return undefined
        fields[index] = { key, expected }
      }
      prototypes[prototypes.length] = { owner, fields }
    }
    const current = () => {
      try {
        for (let index = 0; index < pins.length; index++) {
          const pin = pins[index]!
          if (!sameCaptureDescriptor(captureDescriptor(pin.owner, pin.key), pin.expected)) return false
        }
        if (capturePrototype(objectPrototype) !== null || capturePrototype(arrayPrototype) !== objectPrototype ||
          capturePrototype(hashPrototype) !== hashParent || captureDescriptor(objectPrototype, "toJSON") ||
          captureDescriptor(arrayPrototype, "toJSON")) return false
        for (let index = 0; index < prototypes.length; index++) {
          const pin = prototypes[index]!, names = captureOwnKeys(pin.owner)
          if (names.length !== pin.fields.length) return false
          for (let position = 0; position < names.length; position++) {
            const field = pin.fields[position]!
            if (names[position] !== field.key ||
              !sameCaptureDescriptor(captureDescriptor(pin.owner, field.key), field.expected)) return false
          }
        }
        return true
      } catch { return false }
    }
    if (!current()) return undefined
    const captured = captureFreeze({ isProxy: proxy.value as (value: unknown) => boolean, current })
    try {
      const engine = Bun
      const version = captureDescriptor(engine, "version"), revision = captureDescriptor(engine, "revision")
      const names = ["isNativeError", "isAnyArrayBuffer", "isArrayBufferView"]
      const predicates: { key: string; expected: PropertyDescriptor; test: (value: unknown) => boolean }[] = []
      for (let index = 0; index < names.length; index++) {
        const key = names[index]
        if (key === undefined) break
        const expected = captureDescriptor(proxyTypes, key)
        if (!expected || !captureOwn(expected, "value")) break
        const test: unknown = expected.value
        if (typeof test !== "function") break
        predicates[index] = { key, expected, test: (value: unknown) => test(value) === true }
      }
      if (version && revision && captureOwn(version, "value") && captureOwn(revision, "value") &&
        ((version.value === "1.3.14" && revision.value === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4") ||
          (version.value === "1.4.1" && revision.value === "4661e494f052c83c80dade1318e5710238340be6")) &&
        predicates.length === names.length) {
        originalProjectionRuntime = captureFreeze({
          reject: (value: unknown) => {
            if (captured.isProxy(value)) return true
            for (let index = 0; index < predicates.length; index++) {
              const predicate = predicates[index]
              if (!predicate || predicate.test(value)) return true
            }
            return false
          },
          current: () => {
            if (!current() || !sameCaptureDescriptor(captureDescriptor(engine, "version"), version) ||
              !sameCaptureDescriptor(captureDescriptor(engine, "revision"), revision)) return false
            for (let index = 0; index < predicates.length; index++) {
              const pin = predicates[index]
              if (!pin || !sameCaptureDescriptor(captureDescriptor(proxyTypes, pin.key), pin.expected)) return false
            }
            return true
          },
        })
      }
    } catch { /* Missing optional predicates do not disable the existing capture proof. */ }
    return captured
  } catch { return undefined }
}

const originalCaptureRuntime = initializeCaptureRuntime()

/** A private frozen backend capability; it carries no domain state or authority. */
export function sfCanonicalCaptureRuntime(): SfCanonicalCaptureRuntime | undefined {
  return originalCaptureRuntime?.current() ? originalCaptureRuntime : undefined
}

export function sfCanonicalProjectionRuntime(): SfCanonicalProjectionRuntime | undefined {
  try { return originalProjectionRuntime?.current() ? originalProjectionRuntime : undefined }
  catch { return undefined }
}

/** Memoized canonical bytes require the original serializer and plain tagged arrays. */
export function sfCanonicalSerializerUnhooked() {
  return JSON.stringify === canonicalStringify && Object.getPrototypeOf(Array.prototype) === Object.prototype &&
    !Object.getOwnPropertyDescriptor(Array.prototype, "toJSON") &&
    !Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
}

export function canonicalSfValue(value: unknown): string {
  const tree = sfCanonicalCloneTree(value)
  if (tree) return JSON.stringify(tree)
  return JSON.stringify(canonical(value))
}

export function digestSfValue(value: unknown): string {
  pulsePortfolioJscDiagnostic()
  return new Bun.CryptoHasher("sha256").update(canonicalSfValue(value)).digest("hex")
}

/** Integrity of the whole reference; authentication remains in the source resolver. */
export function digestSfEvidenceRef(reference: BusinessEvidenceRef): string {
  return digestSfValue(Object.fromEntries(Object.entries(reference).filter(([key]) => key !== "refDigest")))
}

/** The digest field itself is excluded; all other envelope fields are bound to this revision. */
export function digestSfContribution(envelope: ContributionEnvelope): string {
  return digestSfValue(Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== "outputDigest")))
}

function canonical(value: unknown): unknown {
  if (value === undefined) return ["absent"]
  if (value === null) return ["null"]
  if (typeof value === "string" || typeof value === "boolean") return [typeof value, value]
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SF_CANONICAL_NONFINITE")
    return ["number", Object.is(value, -0) ? "-0" : value]
  }
  if (Array.isArray(value)) return ["array", value.map(canonical)]
  if (typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error("SF_CANONICAL_UNSUPPORTED")
  const record = value as Record<string, unknown>
  return ["object", Object.keys(record).sort().map((key) => [key, canonical(record[key])])]
}

/** Join memory source identities to the original evidence digest, including authorized historical refs. */
export function sfEvidenceSourceMaps(refs: readonly BusinessEvidenceRef[], options?: { detached?: true }) {
  const sourceVersions: Record<string, number> = {}
  const sourceIncarnations: Record<string, string> = {}
  const active = new WeakSet<object>()
  // A private structured clone preserves aliases but cannot change during this walk.
  const digests = options?.detached ? new WeakMap<object, string>() : undefined
  const visit = (ref: BusinessEvidenceRef, depth: number) => {
    if (!ref || typeof ref !== "object" || depth > 16 || active.has(ref) ||
      !["record", "document", "receipt", "case-event", "calculation", "policy"].includes(ref.kind)) throw new Error("SF_EVIDENCE_GRAPH_INVALID")
    active.add(ref)
    if (ref.kind === "calculation") ref.target.sourceRefs.forEach((child) => visit(child, depth + 1))
    if (ref.kind === "case-event") ref.target.evidenceRefs.forEach((child) => visit(child, depth + 1))
    const digest = digests?.get(ref) ?? digestSfEvidenceRef(ref)
    if (ref.refDigest !== digest) throw new Error("SF_EVIDENCE_DIGEST_INVALID")
    digests?.set(ref, digest)
    const identity = ref.kind === "record" ? { version: ref.target.version, incarnation: ref.target.incarnation }
      : ref.kind === "document" ? { version: ref.target.revision, incarnation: ref.target.incarnation }
      : ref.kind === "receipt" ? { version: ref.target.version, incarnation: ref.target.targetIncarnation }
      : ref.kind === "case-event" ? { version: ref.target.caseVersion, incarnation: ref.target.caseIncarnation }
      : undefined
    if (identity) {
      if (!Number.isSafeInteger(identity.version) || identity.version < 0 || !identity.incarnation.trim()) throw new Error("SF_EVIDENCE_SOURCE_IDENTITY_INVALID")
      sourceVersions[ref.refDigest] = identity.version
      sourceIncarnations[ref.refDigest] = identity.incarnation
    }
    active.delete(ref)
  }
  refs.forEach((ref) => visit(ref, 0))
  return { sourceVersions, sourceIncarnations }
}
