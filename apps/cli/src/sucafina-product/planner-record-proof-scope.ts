import { AsyncLocalStorage } from "node:async_hooks"
import { sfRecallCost, sfRecallAsyncCost } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/recall-observation-cost.ts"
import { types } from "node:util"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { readSfPlannerCalculationRootProof, type SfPlannerCalculationRootProof } from "./planner-calculation-root.ts"

type Frame = {
  open: boolean
  invalid: boolean
  call: TrustedDomainContext
  refs: ReadonlySet<string>
  busy: Set<string>
  values: Map<string, BusinessEvidenceResolution>
  authorize: () => Promise<boolean>
  current: () => boolean
}

const asyncFunctionPrototype = Object.getPrototypeOf(async () => undefined)

/** Pin factory-born readers before their objects are exposed to callers. */
export function pinSfPlannerRecordReaders(readers: readonly unknown[]) {
  const pins = readers.map((reader) => {
    if (!reader || typeof reader !== "object" && typeof reader !== "function" || types.isProxy(reader)) return undefined
    const prototype = Object.getPrototypeOf(reader)
    if (prototype !== Object.prototype && prototype !== Function.prototype && prototype !== asyncFunctionPrototype) return undefined
    const keys = Reflect.ownKeys(reader)
    const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(reader, key))
    if (descriptors.some((descriptor) => !descriptor || !Object.hasOwn(descriptor, "value"))) return undefined
    return { reader, prototype, keys, descriptors }
  })
  return () => pins.every((pin) => {
    if (!pin || types.isProxy(pin.reader) || Object.getPrototypeOf(pin.reader) !== pin.prototype) return false
    const keys = Reflect.ownKeys(pin.reader)
    return keys.length === pin.keys.length && keys.every((key, index) => {
      if (key !== pin.keys[index]) return false
      const current = Object.getOwnPropertyDescriptor(pin.reader, key), before = pin.descriptors[index]!
      return !!current && Object.hasOwn(current, "value") && current.value === before.value &&
        current.enumerable === before.enumerable && current.configurable === before.configurable && current.writable === before.writable
    })
  })
}

/** Reuse completed terminal facts only within one admitted native readonly owner.
 * Authorization is always current; no pending producer or proof survives a phase. */
export function createSfPlannerRecordProofScope(input: { host: DomainPortHost; readersCurrent: () => boolean }) {
  const frames = new AsyncLocalStorage<Frame>()
  const host = input.host, readersCurrent = input.readersCurrent
  const unavailable = () => ({ status: "unavailable", reason: "planner-record-proof-unavailable" } as const)
  const terminal = (ref: BusinessEvidenceRef) => ref.kind === "record" && ref.target.surface === "planner" &&
    ref.target.recordType === "planner-version" && !!ref.target.period
  const observe = async (ref: BusinessEvidenceRef, call: TrustedDomainContext,
    readCanonical: () => Promise<BusinessEvidenceResolution>): Promise<BusinessEvidenceResolution> => {
    const frame = frames.getStore()
    if (!frame) return sfRecallAsyncCost("proof-canonical", () => readCanonical())
    const refused = (): BusinessEvidenceResolution => {
      frame.invalid = true
      return { state: "unavailable", ref: sfRecallCost("proof-clone", () => structuredClone(ref)), accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
    }
    let key: string | undefined, entered = false
    try {
      if (frame.call !== call || !sfRecallCost("proof-frame-current", () => frame.current()) || !terminal(ref)) return refused()
      const captured = sfRecallCost("proof-clone", () => structuredClone(ref))
      key = sfRecallCost("proof-refs-digest", () => digestSfValue(captured))
      if (!frame.refs.has(key) || frame.busy.has(key)) return refused()
      frame.busy.add(key)
      entered = true
      const current = () => sfRecallCost("proof-frame-current", () => frame.current()) && frame.call === call && sfRecallCost("proof-refs-digest", () => digestSfValue(ref)) === key && sfRecallCost("proof-refs-digest", () => digestSfValue(captured)) === key
      if (!await sfRecallAsyncCost("proof-authorize", () => frame.authorize()) || !sfRecallCost("proof-leaf-current", () => current())) return refused()
      const existing = frame.values.get(key)
      if (existing) return sfRecallCost("proof-cache-hit", () => sfRecallCost("proof-clone", () => structuredClone(existing)))
      const result = await sfRecallAsyncCost("proof-canonical", () => readCanonical())
      if (!sfRecallCost("proof-leaf-current", () => current())) return refused()
      const value = sfRecallCost("proof-clone", () => structuredClone(result)), resultDigest = sfRecallCost("proof-refs-digest", () => digestSfValue(value))
      if (value.state !== "fresh" || !value.currentRef || !value.authorizedProjection || value.accessRevision !== call.binding.accessRevision ||
        sfRecallCost("proof-refs-digest", () => digestSfValue(value.ref)) !== key || sfRecallCost("proof-refs-digest", () => digestSfValue(value.currentRef)) !== key) return refused()
      if (!await sfRecallAsyncCost("proof-authorize", () => frame.authorize()) || !sfRecallCost("proof-leaf-current", () => current()) || resultDigest !== sfRecallCost("proof-refs-digest", () => digestSfValue(result))) return refused()
      // Keep the producer's timestamps and bytes. Reauthorization is separate
      // from the completed observation and never pretends a new source read ran.
      frame.values.set(key, value)
      return sfRecallCost("proof-clone", () => structuredClone(value))
    } catch { return refused() }
    finally { if (entered && key !== undefined) frame.busy.delete(key) }
  }
  const run = async <Value>(refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext,
    proof: SfPlannerCalculationRootProof | undefined, authorize: () => Promise<boolean>, unchanged: () => boolean,
    work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const parent = frames.getStore()
    if (parent) { parent.invalid = true; return unavailable() }
    try {
      // Opaque/older compositions retain every original producer. Once an owner
      // is admitted, failure never replays that producer outside its scope.
      if (!proof) return await sfRecallAsyncCost("proof-work", () => work())
      const owner = readSfPlannerCalculationRootProof(proof, host, call)
      if (!owner || !sfRecallCost("proof-owner-current", () => owner.current()) || !sfRecallCost("proof-unchanged", () => unchanged())) return unavailable()
      if (!sfRecallCost("proof-readers-current", () => readersCurrent())) return await sfRecallAsyncCost("proof-work", () => work())
      if (!refs.length || !refs.every(terminal)) return unavailable()
      const refsDigest = sfRecallCost("proof-refs-digest", () => digestSfValue(refs)), admitted = new Set(refs.map((ref) => sfRecallCost("proof-refs-digest", () => digestSfValue(ref))))
      const frame: Frame = { open: true, invalid: false, call, refs: admitted, busy: new Set(), values: new Map(), authorize,
        current: () => {
          if (frame.invalid) return false
          try {
            const valid = frame.open && frames.getStore() === frame && input.host === host && input.readersCurrent === readersCurrent &&
              sfRecallCost("proof-readers-current", () => readersCurrent()) && sfRecallCost("proof-owner-current", () => owner.current()) && sfRecallCost("proof-unchanged", () => unchanged()) && sfRecallCost("proof-refs-digest", () => digestSfValue(refs)) === refsDigest
            if (!valid) frame.invalid = true
            return valid
          } catch { frame.invalid = true; return false }
        } }
      try {
        return await sfRecallAsyncCost("proof-frame-admitted", () => frames.run(frame, async () => {
          if (!sfRecallCost("proof-frame-current", () => frame.current())) return unavailable()
          const result = await sfRecallAsyncCost("proof-work", () => work())
          return sfRecallCost("proof-frame-current", () => frame.current()) && frame.busy.size === 0 ? result : unavailable()
        }))
      } finally { frame.open = false; frame.values.clear(); frame.busy.clear() }
    } catch { return unavailable() }
  }
  return { observe, run }
}
