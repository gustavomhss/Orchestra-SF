import { AsyncLocalStorage } from "node:async_hooks"
import { isDeepStrictEqual, types } from "node:util"

// Snapshot-only numeric aggregates. Tuples keep only a private plain-data baseline until owner close;
// no request, reference, authority value, digest or result is emitted.
// Header: schema, owner, parent, depth, kind, phase, fulfilled, epochMs, elapsedUs, activeAsync.
// kind: 0 Finance, 1 case read, 2 Recall, 3/4 first/second Materiality read.
// phase: 0 settlement, 1/2 first read/rank,
// 3 match-memory read, 4/5 second rank/read, 6 child settlement. fulfilled=2 is partial.
// Count/elapsedUs pairs follow. Partial rows include elapsed time of open async calls;
// all timings are inclusive, cumulative and cannot be summed across nesting or checkpoints.
const buckets = ["owner-current","owner-readers","owner-environment","witness-before","witness-after","witness-egress","owner-state-cases","owner-state-atlas","owner-digest","owner-materialized","owner-authenticate","owner-revalidate","owner-work","owner-clone","root-prepare","record-scope","root-pinned","root-current","root-healthy","root-native-lookup","root-native-current","root-owner-current","root-request-identity","root-binding-digest","proof-frame-current","proof-readers-current","proof-owner-current","proof-unchanged","proof-refs-digest","proof-leaf-current","proof-authorize","proof-work","proof-canonical","proof-clone","canonical-read-first","canonical-read-second","canonical-rank-first","canonical-rank-second","canonical-memory-match","canonical-features","canonical-select","bcs-source","bcs-case-event","bcs-dependencies","bcs-source-maps","bcs-context","bcs-auth","event-read-first","event-read-second","event-state","event-authorize-case","event-authorize-evidence","event-environment","event-auth","event-digest","event-source-maps","atlas-read-records","atlas-state","atlas-case-read","atlas-evidence","atlas-evidence-batch","atlas-continuity","atlas-stable","atlas-authorize","atlas-digest","atlas-source-maps","atlas-map-entry","atlas-features","atlas-rank-authorized","atlas-finalize","atlas-rank-digest","atlas-capture","bcs-capture-integrity","bcs-capture-stable","bcs-context-digest","owner-frame-admitted","owner-frame-current","proof-cache-hit","proof-frame-admitted","finance-closed-pair","finance-snapshot-digest","c08-transaction","c08-authorize","c08-read-state","c08-clone","c08-selection","c08-callback"] as const
type Bucket = typeof buckets[number]
type Profile = {
  id: number
  parent: number
  depth: number
  kind: 0 | 1 | 2 | 3 | 4
  started: number
  epoch: number
  closed: boolean
  checkpoints: number
  pending: Set<{ bucket: Bucket; started: number }>
  values: Record<Bucket, [number, number]>
  tuple?: TupleProfile
}
const profiles = new AsyncLocalStorage<Profile>()
let sequence = 0

export function sfRecallCost<Value>(bucket: Bucket, read: () => Value): Value {
  const profile = profiles.getStore()
  if (!profile || profile.closed) return read()
  const started = performance.now()
  profile.values[bucket][0]++
  try { return read() }
  finally { profile.values[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
}

/** Attach a passive settlement observer and return the exact original Promise. */
export function sfRecallAsyncCost<Value>(bucket: Bucket, read: () => Promise<Value>): Promise<Value> {
  const profile = profiles.getStore()
  if (!profile || profile.closed) return read()
  const entry = { bucket, started: performance.now() }
  profile.values[bucket][0]++
  profile.pending.add(entry)
  let complete = false
  const settled = () => {
    if (complete) return
    complete = true
    profile.values[bucket][1] += Math.max(0, Math.round((performance.now() - entry.started) * 1000))
    profile.pending.delete(entry)
  }
  let pending: Promise<Value>
  try { pending = read() } catch (error) { settled(); throw error }
  void pending.then(settled, settled)
  return pending
}

/** Preserve a state callback's exact return. Native Promises are observed without reading a then getter.
 * Synchronous values and non-native thenables keep their original await behavior; only invocation is timed. */
export function sfRecallReadCost<Value>(bucket: Bucket, read: () => Value | Promise<Value>): Value | Promise<Value> {
  const profile = profiles.getStore()
  if (!profile || profile.closed) return read()
  const started = performance.now()
  profile.values[bucket][0]++
  const entry = { bucket, started }
  let complete = false
  const settled = () => {
    if (complete) return
    complete = true
    profile.values[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000))
    profile.pending.delete(entry)
  }
  let value: Value | Promise<Value>
  try { value = read() } catch (error) { settled(); throw error }
  if (types.isPromise(value)) {
    profile.pending.add(entry)
    try { void Promise.prototype.then.call(value, settled, settled) }
    catch { settled() }
  } else settled()
  return value
}

/** One final row per callback; only existing producer boundaries may publish a partial row. */
export function sfRecallCostOwner<Value>(kind: 0 | 1 | 2 | 3 | 4, work: () => Promise<Value>): Promise<Value> {
  const parent = profiles.getStore()
  const profile: Profile = {
    id: ++sequence, parent: parent?.id ?? 0, depth: parent ? parent.depth + 1 : 0, kind,
    started: performance.now(), epoch: Date.now(), closed: false, checkpoints: 0, pending: new Set(),
    values: Object.fromEntries(buckets.map((bucket) => [bucket, [0, 0]])) as Record<Bucket, [number, number]>,
  }
  return profiles.run(profile, () => {
    const finish = (fulfilled: 0 | 1) => {
      emit(profile, 0, fulfilled)
      if (parent && (kind === 1 && parent.kind === 2 || parent.kind === 3 || parent.kind === 4)) checkpoint(parent, 6)
    }
    let pending: Promise<Value>
    try { pending = work() } catch (error) { finish(0); throw error }
    void pending.then(() => finish(1), () => finish(0))
    return pending
  })
}

export function sfRecallCheckpoint(phase: 1 | 2 | 3 | 4 | 5) {
  const profile = profiles.getStore()
  if (profile) checkpoint(profile, phase)
}

function checkpoint(profile: Profile, phase: number) {
  if (profile.closed || profile.checkpoints >= 32) return
  profile.checkpoints++
  emit(profile, phase, 2)
}

function emit(profile: Profile, phase: number, fulfilled: 0 | 1 | 2) {
  if (profile.closed) return
  if (phase === 0) profile.closed = true
  try {
    const now = performance.now()
    const elapsed = new Map<Bucket, number>()
    for (const entry of profile.pending)
      elapsed.set(entry.bucket, (elapsed.get(entry.bucket) ?? 0) + Math.max(0, Math.round((now - entry.started) * 1000)))
    const fields = [1, profile.id, profile.parent, profile.depth, profile.kind, phase, fulfilled, profile.epoch,
      Math.max(0, Math.round((now - profile.started) * 1000)), profile.pending.size,
      ...buckets.flatMap((bucket) => [profile.values[bucket][0], profile.values[bucket][1] + (elapsed.get(bucket) ?? 0)])]
    process.stdout.write("SF_RECALL_COST " + fields.join(" ") + "\n")
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
  finally { emitTuple(profile, phase, fulfilled) }
}


// Independent diagnostic only: always execute the original digest once, then measure whether
// a fresh complete tuple equals a private prior copy. No hash is stored or reused.
// SF_TUPLE_COST has the same 10 headers as SF_RECALL_COST, then 22 numeric fields:
// attempts, acquireCount/Us, digestCount/Us, validationCount/Us, eligible, ineligible,
// compareCount/Us, equal, unequal, cloneCount/Us, originalThrows, observationErrors,
// intrinsicRefusals, graphRefusals, visitedNodes, maxVisitedNodes, baselineActive.
type TupleProfile = {
  baseline: unknown
  attempts: number
  acquire: [number, number]
  digest: [number, number]
  validation: [number, number]
  eligible: number
  ineligible: number
  compare: [number, number]
  equal: number
  unequal: number
  clone: [number, number]
  originalThrows: number
  observationErrors: number
  intrinsicRefusals: number
  graphRefusals: number
  visitedNodes: number
  maxVisitedNodes: number
}
const tupleDescriptor = Object.getOwnPropertyDescriptor
const tupleOwnKeys = Reflect.ownKeys
const tuplePrototype = Object.getPrototypeOf
const tupleHasOwn = Object.hasOwn
const tupleIsProxy = types.isProxy
const tupleIsArray = Array.isArray
const tupleIsFinite = Number.isFinite
const tupleIsSafeInteger = Number.isSafeInteger
const tupleClone = structuredClone
const tupleEqual = isDeepStrictEqual
const tupleObjectPrototype = Object.prototype
const tupleArrayPrototype = Array.prototype
const tupleHashPrototype = Bun.CryptoHasher.prototype
const tuplePinKeys: readonly (readonly [object, PropertyKey])[] = [
  [globalThis, "Object"], [globalThis, "Array"], [globalThis, "Number"], [globalThis, "JSON"],
  [globalThis, "Reflect"], [globalThis, "Bun"], [globalThis, "WeakSet"], [globalThis, "structuredClone"],
  [Object, "keys"], [Object, "getPrototypeOf"], [Object, "getOwnPropertyDescriptor"], [Object, "hasOwn"], [Object, "is"],
  [Array, "isArray"], [Array, Symbol.species], [Number, "isFinite"], [Number, "isSafeInteger"],
  [Reflect, "ownKeys"], [JSON, "stringify"], [types, "isProxy"],
  [Bun, "CryptoHasher"], [tupleHashPrototype, "update"], [tupleHashPrototype, "digest"],
  [WeakSet.prototype, "has"], [WeakSet.prototype, "add"], [WeakSet.prototype, "delete"],
]
const tuplePins = tuplePinKeys.map(([owner, key]) => ({ owner, key, descriptor: tupleDescriptor(owner, key) }))
const tuplePrototypePins = [tupleObjectPrototype, tupleArrayPrototype].map((owner) => ({
  owner, prototype: tuplePrototype(owner), keys: tupleOwnKeys(owner),
  descriptors: tupleOwnKeys(owner).map((key) => tupleDescriptor(owner, key)),
}))

/** The existing cost bucket still covers only acquisition plus the original digest, never the comparison. */
export function sfRecallTupleCost(bucket: Bucket, acquire: () => unknown, read: (value: unknown) => string): string {
  const profile = profiles.getStore()
  if (!profile || profile.closed || profile.kind !== 0 && profile.kind !== 1)
    return sfRecallCost(bucket, () => read(acquire()))
  const tuple = profile.tuple ??= {
    baseline: undefined, attempts: 0, acquire: [0, 0], digest: [0, 0], validation: [0, 0],
    eligible: 0, ineligible: 0, compare: [0, 0], equal: 0, unequal: 0, clone: [0, 0],
    originalThrows: 0, observationErrors: 0, intrinsicRefusals: 0, graphRefusals: 0, visitedNodes: 0, maxVisitedNodes: 0,
  }
  tuple.attempts++
  let value: unknown
  let result: string
  try {
    result = sfRecallCost(bucket, () => {
      const acquired = performance.now()
      tuple.acquire[0]++
      try { value = acquire() }
      finally { tuple.acquire[1] += Math.max(0, Math.round((performance.now() - acquired) * 1000)) }
      const started = performance.now()
      tuple.digest[0]++
      try { return read(value) }
      finally { tuple.digest[1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
    })
  } catch (error) { tuple.originalThrows++; throw error }
  try { observeTuple(tuple, value) }
  catch { tuple.observationErrors++; tuple.baseline = undefined }
  return result
}

function observeTuple(tuple: TupleProfile, value: unknown) {
  const started = performance.now()
  tuple.validation[0]++
  const inspected = { nodes: 0 }
  let eligible = false
  try {
    if (!tupleIntrinsicsCurrent()) { tuple.intrinsicRefusals++; return }
    eligible = plainTuple(value, new WeakSet(), new WeakSet(), inspected)
    if (!eligible) { tuple.graphRefusals++; return }
  } finally {
    tuple.validation[1] += Math.max(0, Math.round((performance.now() - started) * 1000))
    tuple.visitedNodes += inspected.nodes
    tuple.maxVisitedNodes = Math.max(tuple.maxVisitedNodes, inspected.nodes)
    if (!eligible) { tuple.ineligible++; tuple.baseline = undefined }
  }
  tuple.eligible++
  if (tuple.baseline !== undefined) {
    const compared = performance.now()
    tuple.compare[0]++
    let equal = false
    try { equal = tupleEqual(value, tuple.baseline) }
    finally { tuple.compare[1] += Math.max(0, Math.round((performance.now() - compared) * 1000)) }
    if (equal) { tuple.equal++; return }
    tuple.unequal++
  }
  const cloned = performance.now()
  tuple.clone[0]++
  try { tuple.baseline = tupleClone(value) }
  finally { tuple.clone[1] += Math.max(0, Math.round((performance.now() - cloned) * 1000)) }
}

function tupleIntrinsicsCurrent() {
  for (let index = 0; index < tuplePins.length; index++) {
    const pin = tuplePins[index]!
    if (!sameTupleDescriptor(pin.descriptor, tupleDescriptor(pin.owner, pin.key))) return false
  }
  for (let index = 0; index < tuplePrototypePins.length; index++) {
    const pin = tuplePrototypePins[index]!, keys = tupleOwnKeys(pin.owner)
    if (tuplePrototype(pin.owner) !== pin.prototype || keys.length !== pin.keys.length) return false
    for (let entry = 0; entry < keys.length; entry++)
      if (keys[entry] !== pin.keys[entry] || !sameTupleDescriptor(pin.descriptors[entry], tupleDescriptor(pin.owner, keys[entry]!))) return false
  }
  return true
}

function sameTupleDescriptor(left: PropertyDescriptor | undefined, right: PropertyDescriptor | undefined) {
  if (!left || !right) return left === right
  if (left.enumerable !== right.enumerable || left.configurable !== right.configurable ||
    tupleHasOwn(left, "value") !== tupleHasOwn(right, "value")) return false
  return tupleHasOwn(left, "value") ? left.value === right.value && left.writable === right.writable
    : left.get === right.get && left.set === right.set
}

/** No value gets or hooks: inspect descriptors only after rejecting proxies. Aliases are allowed; cycles are not. */
function plainTuple(value: unknown, active: WeakSet<object>, checked: WeakSet<object>, inspected: { nodes: number }): boolean {
  inspected.nodes++
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return tupleIsFinite(value)
  if (typeof value !== "object" || tupleIsProxy(value) || active.has(value)) return false
  if (checked.has(value)) return true
  const array = tupleIsArray(value), prototype = tuplePrototype(value)
  // The clone/compare experiment deliberately uses the JSON plain subset; null/custom prototypes are ineligible.
  if (prototype !== (array ? tupleArrayPrototype : tupleObjectPrototype)) return false
  const keys = tupleOwnKeys(value)
  active.add(value)
  try {
    if (array) {
      const length = tupleDescriptor(value, "length")
      if (!length || !tupleHasOwn(length, "value") || !tupleIsSafeInteger(length.value) || length.value < 0 ||
        keys.length !== length.value + 1) return false
      for (let index = 0; index < length.value; index++) {
        const entry = tupleDescriptor(value, index + "")
        if (!entry || !entry.enumerable || !tupleHasOwn(entry, "value") || !plainTuple(entry.value, active, checked, inspected)) return false
      }
    } else {
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index]!
        if (typeof key !== "string") return false
        const entry = tupleDescriptor(value, key)
        if (!entry || !entry.enumerable || !tupleHasOwn(entry, "value") || !plainTuple(entry.value, active, checked, inspected)) return false
      }
    }
    checked.add(value)
    return true
  } finally { active.delete(value) }
}

function emitTuple(profile: Profile, phase: number, fulfilled: 0 | 1 | 2) {
  const tuple = profile.tuple
  if (!tuple) return
  if (phase === 0) tuple.baseline = undefined
  try {
    const fields = [1, profile.id, profile.parent, profile.depth, profile.kind, phase, fulfilled, profile.epoch,
      Math.max(0, Math.round((performance.now() - profile.started) * 1000)), profile.pending.size,
      tuple.attempts, ...tuple.acquire, ...tuple.digest, ...tuple.validation, tuple.eligible, tuple.ineligible,
      ...tuple.compare, tuple.equal, tuple.unequal, ...tuple.clone, tuple.originalThrows, tuple.observationErrors,
      tuple.intrinsicRefusals, tuple.graphRefusals, tuple.visitedNodes, tuple.maxVisitedNodes, tuple.baseline === undefined ? 0 : 1]
    process.stdout.write("SF_TUPLE_COST " + fields.join(" ") + "\n")
  } catch { /* Tuple diagnostics cannot replace the original result or retain the baseline after settlement. */ }
}
