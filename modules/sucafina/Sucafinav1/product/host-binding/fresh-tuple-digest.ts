import { AsyncLocalStorage } from "node:async_hooks"
import { types } from "node:util"
import { digestSfValue, sfCanonicalSerializerUnhooked } from "../contracts/canonical.ts"

const descriptor = Object.getOwnPropertyDescriptor
const ownKeys = Reflect.ownKeys
const prototype = Object.getPrototypeOf
const hasOwn = Object.hasOwn
const same = Object.is
const isProxy = types.isProxy
const isArray = Array.isArray
const finite = Number.isFinite
const safeInteger = Number.isSafeInteger
const clone = structuredClone
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const hashPrototype = Bun.CryptoHasher.prototype
const pinKeys: readonly (readonly [object, PropertyKey])[] = [
  [globalThis, "Object"], [globalThis, "Array"], [globalThis, "Number"], [globalThis, "JSON"],
  [globalThis, "Reflect"], [globalThis, "Bun"], [globalThis, "WeakSet"], [globalThis, "WeakMap"], [globalThis, "structuredClone"],
  [Object, "prototype"], [Object, "keys"], [Object, "getPrototypeOf"], [Object, "getOwnPropertyDescriptor"], [Object, "hasOwn"], [Object, "is"],
  [Array, "prototype"], [Array, "isArray"], [Array, Symbol.species], [Number, "isFinite"], [Number, "isSafeInteger"],
  [Reflect, "ownKeys"], [JSON, "stringify"], [types, "isProxy"],
  [Bun, "CryptoHasher"], [Bun.CryptoHasher, "prototype"], [hashPrototype, "update"], [hashPrototype, "digest"],
  [WeakSet, "prototype"], [WeakSet.prototype, "constructor"], [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
  [WeakMap, "prototype"], [WeakMap.prototype, "constructor"], [WeakMap.prototype, "get"], [WeakMap.prototype, "set"],
]
const pins = pinKeys.map(([owner, key]) => ({ owner, key, value: descriptor(owner, key) }))
const prototypePins = [objectPrototype, arrayPrototype].map((owner) => ({
  owner, parent: prototype(owner), keys: ownKeys(owner), values: ownKeys(owner).map((key) => descriptor(owner, key)),
}))


export type SfFreshTupleFamily = "finance" | "case" | "recall"
type Retained = { value: unknown; digest: string }
type TupleState = { retained: Retained | undefined; closed: boolean; busy: boolean }
type ReadFrame = { open: boolean; slots: [TupleState, TupleState, TupleState] }
type SharedLease = { token: object; family: 0 | 1 | 2; closed: boolean }

const apply = Reflect.apply
const StateMap = WeakMap
const stateGet = StateMap.prototype.get
const stateSet = StateMap.prototype.set
const stateDelete = StateMap.prototype.delete
const ReadContext = AsyncLocalStorage
const readContext = new ReadContext<object>()
const contextPrototype = ReadContext.prototype
const contextRun = contextPrototype.run
const contextGet = contextPrototype.getStore
const contextParent = prototype(contextPrototype)
const contextConstructorParent = prototype(ReadContext)
const contextKeys = ownKeys(contextPrototype)
const contextValues = contextKeys.map((key) => descriptor(contextPrototype, key))
const scopePinKeys: readonly (readonly [object, PropertyKey])[] = [
  [Reflect, "apply"], [StateMap, "prototype"],
  [StateMap.prototype, "get"], [StateMap.prototype, "set"], [StateMap.prototype, "delete"],
  [ReadContext, "prototype"], [ReadContext, "bind"], [ReadContext, "snapshot"],
  [Function.prototype, "call"], [Function.prototype, "apply"], [Function.prototype, "bind"],
  [readContext, "run"], [readContext, "getStore"], [readContext, "enterWith"], [readContext, "exit"], [readContext, "disable"],
]
const scopePins = scopePinKeys.map(([owner, key]) => ({ owner, key, value: descriptor(owner, key) }))
let readFrames = new StateMap<object, ReadFrame>()

function tupleState(): TupleState { return { retained: undefined, closed: false, busy: false } }

/** A fixed lifetime only: ALS carries an opaque token, never a tuple, digest, slot or authority.
 * The original async body closes its token in finally, before its own Promise settles. */
export function runSfFreshTupleRead<Value>(work: (close: () => void) => Value): Value {
  const token = {}
  const close = () => closeRead(token)
  let registered = false
  try {
    if (scopeCurrent()) {
      apply(stateSet, readFrames, [token, { open: true, slots: [tupleState(), tupleState(), tupleState()] }])
      registered = true
    }
  } catch { revokeReadFrames() }
  if (!registered) return work(close)
  try { return apply(contextRun, readContext, [token, () => work(close)]) }
  catch (error) { close(); throw error }
}

/** Every call still receives and inspects the complete fresh tuple. An explicit family may
 * share only a pure digest baseline inside its current read; absent/outside scopes stay local. */
export function createSfFreshTupleDigest(family?: SfFreshTupleFamily) {
  const lease = family === "finance" || family === "case" || family === "recall" ? currentLease(family) : undefined
  if (lease) return {
    digest(value: unknown): string {
      const state = sharedState(lease)
      return state ? digestTuple(value, state, lease) : digestSfValue(value)
    },
    close() { lease.closed = true },
  }
  const state = tupleState()
  return {
    digest(value: unknown): string { return digestTuple(value, state) },
    close() { state.closed = true; state.retained = undefined },
  }
}

function digestTuple(value: unknown, state: TupleState, lease?: SharedLease): string {
  if (state.closed || state.busy) return digestSfValue(value)
  state.busy = true
  try {
    let admitted = false
    try {
      if (intrinsicsCurrent()) {
        const result = inspect(value, state.retained?.value, state.retained !== undefined, new WeakMap())
        admitted = result !== 0
        if (result === 2 && state.retained && intrinsicsCurrent() && currentState(state, lease)) return state.retained.digest
      }
    } catch { /* Unprovable inspection keeps the original digest path. */ }
    // An opaque read or original serializer can reenter; no prior baseline is visible to it.
    state.retained = undefined
    // Deliberately outside the observational catch: propagate the original error without replay.
    const digest = digestSfValue(value)
    if (admitted && !state.closed && currentState(state, lease)) {
      try {
        if (intrinsicsCurrent()) {
          const detached = clone(value)
          if (!state.closed && intrinsicsCurrent() && currentState(state, lease)) state.retained = { value: detached, digest }
        }
      } catch { state.retained = undefined }
    }
    return digest
  } finally { state.busy = false }
}

function currentState(state: TupleState, lease: SharedLease | undefined) {
  return lease === undefined || sharedState(lease) === state
}

function currentLease(family: SfFreshTupleFamily): SharedLease | undefined {
  if (!scopeCurrent()) return undefined
  const token: object | undefined = apply(contextGet, readContext, [])
  if (!token) return undefined
  const frame = readFrame(token)
  if (!frame?.open) return undefined
  return { token, family: family === "finance" ? 0 : family === "case" ? 1 : 2, closed: false }
}

function sharedState(lease: SharedLease): TupleState | undefined {
  if (lease.closed || !scopeCurrent()) return undefined
  // A lease cannot inspect either read's slots while another token (or no token) is current.
  if (apply(contextGet, readContext, []) !== lease.token) return undefined
  const frame = readFrame(lease.token)
  if (!frame?.open) return undefined
  const state = frame.slots[lease.family]
  return state.closed ? undefined : state
}

function readFrame(token: object): ReadFrame | undefined {
  return apply(stateGet, readFrames, [token])
}

function closeRead(token: object) {
  // Captured native methods also clean up during drift; no opaque WeakMap hook sees a frame.
  const frame = readFrame(token)
  if (!frame) return
  frame.open = false
  for (let index = 0; index < 3; index++) {
    frame.slots[index]!.closed = true
    frame.slots[index]!.retained = undefined
  }
  apply(stateDelete, readFrames, [token])
}

function revokeReadFrames() {
  // Replacing the private registry permanently revokes every old token. Restoring an
  // intrinsic inside an unscoped nested body cannot resurrect its parent's baseline.
  readFrames = new StateMap<object, ReadFrame>()
}

function scopeCurrent() {
  try {
    if (!intrinsicsCurrent() || AsyncLocalStorage !== ReadContext ||
      prototype(readContext) !== contextPrototype || prototype(contextPrototype) !== contextParent ||
      prototype(ReadContext) !== contextConstructorParent) {
      revokeReadFrames()
      return false
    }
    for (let index = 0; index < scopePins.length; index++) {
      const pin = scopePins[index]!
      if (!sameDescriptor(pin.value, descriptor(pin.owner, pin.key))) {
        revokeReadFrames()
        return false
      }
    }
    const keys = ownKeys(contextPrototype)
    if (keys.length !== contextKeys.length) {
      revokeReadFrames()
      return false
    }
    for (let index = 0; index < keys.length; index++)
      if (keys[index] !== contextKeys[index] || !sameDescriptor(contextValues[index], descriptor(contextPrototype, keys[index]!))) {
        revokeReadFrames()
        return false
      }
    return true
  } catch {
    revokeReadFrames()
    return false
  }
}

function intrinsicsCurrent() {
  for (let index = 0; index < pins.length; index++) {
    const pin = pins[index]!
    if (!sameDescriptor(pin.value, descriptor(pin.owner, pin.key))) return false
  }
  for (let index = 0; index < prototypePins.length; index++) {
    const pin = prototypePins[index]!, keys = ownKeys(pin.owner)
    if (prototype(pin.owner) !== pin.parent || keys.length !== pin.keys.length) return false
    for (let entry = 0; entry < keys.length; entry++)
      if (keys[entry] !== pin.keys[entry] || !sameDescriptor(pin.values[entry], descriptor(pin.owner, keys[entry]!))) return false
  }
  return sfCanonicalSerializerUnhooked()
}

function sameDescriptor(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined) {
  if (!left || !right) return left === right
  if (left.enumerable !== right.enumerable || left.configurable !== right.configurable ||
    hasOwn(left, "value") !== hasOwn(right, "value")) return false
  return hasOwn(left, "value") ? same(left.value, right.value) && left.writable === right.writable
    : left.get === right.get && left.set === right.set
}

type Seen = { expected: unknown; comparable: boolean; result: 0 | 1 | 2 }

/** 0 opaque, 1 fully admitted but unequal, 2 fully admitted and equal.
 * Objects are always inspected: reference identity alone never proves equality.
 * Repeated aliases may reuse this walk's completed descriptor proof for the SAME private counterpart. */
function inspect(value: unknown, expected: unknown, comparable: boolean,
  seen: WeakMap<object, Seen>): 0 | 1 | 2 {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean")
    return comparable && same(value, expected) ? 2 : 1
  if (typeof value === "number") return !finite(value) ? 0 : comparable && same(value, expected) ? 2 : 1
  if (typeof value !== "object" || isProxy(value)) return 0
  const prior = seen.get(value)
  if (prior?.result === 0) return 0
  if (prior) return prior.comparable === comparable && prior.expected === expected ? prior.result : 1
  const array = isArray(value)
  if (prototype(value) !== (array ? arrayPrototype : objectPrototype)) return 0
  // A clone can retain an exotic brand and shared memory; require the ordinary object/array prototype.
  // Fresh values still receive every descriptor check.
  const partner = comparable && expected !== null && typeof expected === "object" &&
    isArray(expected) === array && prototype(expected) === (array ? arrayPrototype : objectPrototype)
    ? expected as Record<string, unknown> : undefined
  const keys = ownKeys(value)
  let equal = partner !== undefined && (array || ownKeys(partner).length === keys.length)
  // A visiting entry is a cycle even when this visit has a different counterpart.
  const current: Seen = { expected, comparable, result: 0 }
  seen.set(value, current)
  if (array) {
    const length = descriptor(value, "length")
    if (!length || !hasOwn(length, "value") || !safeInteger(length.value) || length.value < 0 ||
      keys.length !== length.value + 1) return 0
    const expectedLength = partner && hasOwn(partner, "length") ? partner.length : undefined
    if (expectedLength !== length.value) equal = false
    for (let index = 0; index < length.value; index++) {
      const entry = descriptor(value, index + "")
      if (!entry || !entry.enumerable || !hasOwn(entry, "value")) return 0
      const present = partner !== undefined && hasOwn(partner, index + "")
      const result = inspect(entry.value, present ? partner[index] : undefined, present, seen)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  } else {
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!
      if (typeof key !== "string") return 0
      const entry = descriptor(value, key)
      if (!entry || !entry.enumerable || !hasOwn(entry, "value")) return 0
      const present = partner !== undefined && hasOwn(partner, key)
      const result = inspect(entry.value, present ? partner[key] : undefined, present, seen)
      if (result === 0) return 0
      if (result !== 2) equal = false
    }
  }
  current.result = equal ? 2 : 1
  return current.result
}
