import { AsyncLocalStorage } from "node:async_hooks"
import { types } from "node:util"

// Snapshot-only numeric aggregates. No request, reference, authority value or result is retained.
// Header: schema, owner, parent, depth, kind, phase, fulfilled, epochMs, elapsedUs, activeAsync.
// kind: 0 Finance, 1 case read, 2 Recall, 3/4 first/second Materiality read.
// phase: 0 settlement, 1/2 first read/rank,
// 3 match-memory read, 4/5 second rank/read, 6 child settlement. fulfilled=2 is partial.
// Count/elapsedUs pairs follow. Partial rows include elapsed time of open async calls;
// all timings are inclusive, cumulative and cannot be summed across nesting or checkpoints.
const buckets = ["owner-current","owner-readers","owner-environment","witness-before","witness-after","witness-egress","owner-state-cases","owner-state-atlas","owner-digest","owner-materialized","owner-authenticate","owner-revalidate","owner-work","owner-clone","root-prepare","record-scope","root-pinned","root-current","root-healthy","root-native-lookup","root-native-current","root-owner-current","root-request-identity","root-binding-digest","proof-frame-current","proof-readers-current","proof-owner-current","proof-unchanged","proof-refs-digest","proof-leaf-current","proof-authorize","proof-work","proof-canonical","proof-clone","canonical-read-first","canonical-read-second","canonical-rank-first","canonical-rank-second","canonical-memory-match","canonical-features","canonical-select","bcs-source","bcs-case-event","bcs-dependencies","bcs-source-maps","bcs-context","bcs-auth","event-read-first","event-read-second","event-state","event-authorize-case","event-authorize-evidence","event-environment","event-auth","event-digest","event-source-maps","atlas-read-records","atlas-state","atlas-case-read","atlas-evidence","atlas-evidence-batch","atlas-continuity","atlas-stable","atlas-authorize","atlas-digest","atlas-source-maps","atlas-map-entry","atlas-features","atlas-rank-authorized","atlas-finalize","atlas-rank-digest","atlas-capture","bcs-capture-integrity","bcs-capture-stable","bcs-context-digest","owner-frame-admitted","owner-frame-current","proof-cache-hit","proof-frame-admitted","finance-closed-pair","finance-snapshot-digest","c08-transaction","c08-authorize","c08-read-state","c08-clone","c08-selection","c08-callback"] as const
type Bucket = typeof buckets[number]

// LocalStore-only sync costs; counts/timings are inclusive and cumulative.
// copyValue is measured only at cloneSnapshot's external call, not its recursion or ACL-only copies.
// Branches: current materializer/clone, then nested ACL/source/materializer/staged/load.
const localStoreBuckets = ["current-snapshots","copy-current","clone-snapshot","clone-tree","validate-snapshot","observe-snapshot","payload-fingerprint","plan-materialization","materialize-snapshot","decode-snapshot","nested-snapshot","dashboard-source-snapshot","snapshot-sql","scope-guard","file-guard"] as const
type LocalStoreBucket = typeof localStoreBuckets[number]
type LocalStoreBranch = 0 | 1 | 2 | 3 | 4 | 5 | 6

// Fresh-tuple detail is diagnostic-only: no value is retained or hashed by the observer.
// Counters: calls, closed-or-busy, opaque inspect, admitted unequal, equal inspect,
// actual retained return, initial pin refusal, baseline retained, observational throw.
const tupleCostBuckets = ["pins","inspect","digest-original","clone"] as const
type TupleCostBucket = typeof tupleCostBuckets[number]
type TupleCounter = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
const materializeCostBuckets = ["json-parse","missing-parse","strings-parse","escaped-decode","plain-slice","restore"] as const
type MaterializeCostBucket = typeof materializeCostBuckets[number]

/** Snapshot-only cross-owner return counts. Families 0/1/2 retain at most 128
 * owner samples and hash strings of at most 128 characters inside ONE kind3/4 read.
 * Hashes never enter output, callbacks, product inputs or a process-wide collection.
 * Family 3 rows contain drops only; their header is the reporting boundary.
 * Counters: original returns, first original, first retained original, first same/different/no
 * other-owner baseline, distinct retained firsts, local hits, hits against different/no shadow,
 * ineligible observations, invalidations, limit, late, missing ancestry, observer errors. */
const tupleCrossLimit = 128
type TupleFamily = 0 | 1 | 2
type TupleCrossCounts = [number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number]
type TupleHashNode = { value: string; next: TupleHashNode | undefined }
type TupleCrossFamily = {
  counts: TupleCrossCounts
  owners: number
  capped: boolean
  first: TupleHashNode | undefined
  last: { owner: number; value: string } | undefined
}
type TupleCrossLedger = { open: boolean; families: [TupleCrossFamily, TupleCrossFamily, TupleCrossFamily] }
function emptyTupleCrossCounts(): TupleCrossCounts { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
function tupleCrossFamily(): TupleCrossFamily {
  return { counts: emptyTupleCrossCounts(), owners: 0, capped: false, first: undefined, last: undefined }
}
function tupleCrossLedger(): TupleCrossLedger {
  return { open: true, families: [tupleCrossFamily(), tupleCrossFamily(), tupleCrossFamily()] }
}

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
  localStore: Record<LocalStoreBucket, [number, number]>
  localBranches: [number, number, number, number, number, number, number]
  tupleCost: Record<TupleCostBucket, [number, number]>
  tupleCounters: [number, number, number, number, number, number, number, number, number]
  materializeCost: Record<MaterializeCostBucket, [number, number]>
  tupleCross: TupleCrossLedger | undefined
  tupleCrossFirst: boolean
  tupleCrossCounted: boolean
  tupleCrossDrops: TupleCrossCounts
}
const profiles = new AsyncLocalStorage<Profile>()
let sequence = 0
// Numeric drops only; no-profile observations cannot retain a hash or a ledger.
const unscopedTupleDrops = emptyTupleCrossCounts()


/** Observe a synchronous boundary without catching/replaying its original result or error. */
export function sfLocalStoreCost<Value>(bucket: LocalStoreBucket, read: () => Value): Value {
  let profile: Profile | undefined
  let started = 0
  try {
    profile = profiles.getStore()
    if (profile && !profile.closed) {
      started = performance.now()
      profile.localStore[bucket][0]++
    } else profile = undefined
  } catch { profile = undefined }
  try { return read() }
  finally {
    if (profile) {
      try { profile.localStore[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
      catch { /* Telemetry cannot replace the original synchronous completion. */ }
    }
  }
}

/** Count only the original selected expression; never evaluate an alternate branch. */
export function sfLocalStoreBranch<Value>(branch: LocalStoreBranch, read: () => Value): Value {
  try {
    const profile = profiles.getStore()
    if (profile && !profile.closed) profile.localBranches[branch]++
  } catch { /* Telemetry cannot replace the selected expression. */ }
  return read()
}



function tupleCrossContext(): { profile: Profile; family: TupleCrossFamily } | undefined {
  const profile = profiles.getStore()
  if (!profile) { unscopedTupleDrops[14]++; return undefined }
  const ledger = profile.tupleCross
  if (profile.kind > 2) { profile.tupleCrossDrops[14]++; return undefined }
  const familyIndex = profile.kind as TupleFamily
  if (profile.closed || ledger && !ledger.open) {
    if (ledger?.open) ledger.families[familyIndex].counts[13]++
    else if (!profile.closed) profile.tupleCrossDrops[13]++
    else unscopedTupleDrops[13]++
    return undefined
  }
  if (!ledger) { profile.tupleCrossDrops[14]++; return undefined }
  const family = ledger.families[familyIndex]
  if (family.capped) { family.counts[12]++; return undefined }
  if (!profile.tupleCrossCounted) {
    profile.tupleCrossCounted = true
    family.owners++
    if (family.owners > tupleCrossLimit) {
      family.capped = true
      family.first = undefined
      family.last = undefined
      family.counts[12]++
      return undefined
    }
  }
  return { profile, family }
}

/** Observe an already returned primitive hash and the actual retention branch only. */
export function sfTupleCrossReturn(kind: 0 | 1, value: unknown, retained: boolean) {
  try {
    const context = tupleCrossContext()
    if (!context) return
    const family = context.family, profile = context.profile
    if (typeof value !== "string" || value.length > tupleCrossLimit) {
      family.capped = true
      family.first = undefined
      family.last = undefined
      family.counts[12]++
      return
    }
    if (kind === 1) {
      family.counts[7]++
      if (!family.last) family.counts[9]++
      else if (family.last.value !== value) family.counts[8]++
      family.last = { owner: profile.id, value }
      return
    }
    family.counts[0]++
    const first = !profile.tupleCrossFirst
    profile.tupleCrossFirst = true
    if (first) family.counts[1]++
    if (!retained) {
      family.counts[10]++
      family.counts[11]++
      family.last = undefined
      return
    }
    if (first) {
      family.counts[2]++
      if (!family.last || family.last.owner === profile.id) family.counts[5]++
      else if (family.last.value === value) family.counts[3]++
      else family.counts[4]++
      let known = false
      for (let entry = family.first; entry; entry = entry.next) {
        if (entry.value === value) { known = true; break }
      }
      if (!known) {
        family.first = { value, next: family.first }
        family.counts[6]++
      }
    }
    family.last = { owner: profile.id, value }
  } catch { unscopedTupleDrops[15]++ }
}

/** No hash is accepted from an opaque, failed or bypassed observation. */
export function sfTupleCrossDiscard() {
  try {
    const context = tupleCrossContext()
    if (!context) return
    context.family.counts[11]++
    context.family.last = undefined
  } catch { unscopedTupleDrops[15]++ }
}

export function sfTupleCrossBypass() {
  try {
    const context = tupleCrossContext()
    if (context) context.family.counts[10]++
  } catch { unscopedTupleDrops[15]++ }
}

function closeTupleCross(profile: Profile) {
  try {
    if (profile.kind !== 3 && profile.kind !== 4 || !profile.tupleCross) return
    profile.tupleCross.open = false
    for (let index = 0; index < 3; index++) {
      profile.tupleCross.families[index]!.first = undefined
      profile.tupleCross.families[index]!.last = undefined
    }
  } catch { unscopedTupleDrops[15]++ }
}

/** Observe only original helper calls; no input, baseline, hash or error is retained here. */
export function sfTupleCost<Value>(bucket: TupleCostBucket, read: () => Value): Value {
  let profile: Profile | undefined
  let started = 0
  try {
    profile = profiles.getStore()
    if (profile && !profile.closed) {
      started = performance.now()
      profile.tupleCost[bucket][0]++
    } else profile = undefined
  } catch { profile = undefined }
  let returned = false
  try { const value = read(); returned = true; return value }
  finally {
    if (bucket === "digest-original" && !returned) sfTupleCrossDiscard()
    if (profile) {
      try { profile.tupleCost[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
      catch { /* Telemetry cannot replace the original synchronous completion. */ }
    }
  }
}

export function sfTupleCount(counter: TupleCounter) {
  try {
    const profile = profiles.getStore()
    if (profile && !profile.closed) profile.tupleCounters[counter]++
  } catch { /* A counter cannot change the existing branch. */ }
}

export function sfTupleInitialPins(read: () => boolean): boolean {
  const value = sfTupleCost("pins", read)
  if (!value) sfTupleCount(6)
  return value
}

export function sfTupleInspect(read: () => 0 | 1 | 2): 0 | 1 | 2 {
  const value = sfTupleCost("inspect", read)
  sfTupleCount(value === 0 ? 2 : value === 1 ? 3 : 4)
  return value
}

/** Time only the original materializer expression, without recording content, size or paths. */
export function sfMaterializeCost<Value>(bucket: MaterializeCostBucket, read: () => Value): Value {
  let profile: Profile | undefined
  let started = 0
  try {
    profile = profiles.getStore()
    if (profile && !profile.closed) {
      started = performance.now()
      profile.materializeCost[bucket][0]++
    } else profile = undefined
  } catch { profile = undefined }
  try { return read() }
  finally {
    if (profile) {
      try { profile.materializeCost[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
      catch { /* Telemetry cannot replace the original synchronous completion. */ }
    }
  }
}

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
    localStore: Object.fromEntries(localStoreBuckets.map((bucket) => [bucket, [0, 0]])) as Record<LocalStoreBucket, [number, number]>,
    localBranches: [0, 0, 0, 0, 0, 0, 0],
    tupleCost: Object.fromEntries(tupleCostBuckets.map((bucket) => [bucket, [0, 0]])) as Record<TupleCostBucket, [number, number]>,
    tupleCounters: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    materializeCost: Object.fromEntries(materializeCostBuckets.map((bucket) => [bucket, [0, 0]])) as Record<MaterializeCostBucket, [number, number]>,
    tupleCross: kind === 3 || kind === 4 ? tupleCrossLedger() : parent?.tupleCross,
    tupleCrossFirst: false, tupleCrossCounted: false, tupleCrossDrops: emptyTupleCrossCounts(),
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
  if (phase === 0) closeTupleCross(profile)
  try {
    const now = performance.now()
    const elapsed = new Map<Bucket, number>()
    for (const entry of profile.pending)
      elapsed.set(entry.bucket, (elapsed.get(entry.bucket) ?? 0) + Math.max(0, Math.round((now - entry.started) * 1000)))
    const fields = [1, profile.id, profile.parent, profile.depth, profile.kind, phase, fulfilled, profile.epoch,
      Math.max(0, Math.round((now - profile.started) * 1000)), profile.pending.size,
      ...buckets.flatMap((bucket) => [profile.values[bucket][0], profile.values[bucket][1] + (elapsed.get(bucket) ?? 0)])]
    process.stdout.write("SF_RECALL_COST " + fields.join(" ") + "\n")
    const localFields = [...fields.slice(0, 10),
      ...localStoreBuckets.flatMap((bucket) => profile.localStore[bucket]), ...profile.localBranches]
    process.stdout.write("SF_LOCAL_STORE_COST " + localFields.join(" ") + "\n")
    const tupleFields = [...fields.slice(0, 10),
      ...tupleCostBuckets.flatMap((bucket) => profile.tupleCost[bucket]), ...profile.tupleCounters]
    process.stdout.write("SF_FRESH_TUPLE_COST " + tupleFields.join(" ") + "\n")
    const materializeFields = [...fields.slice(0, 10),
      ...materializeCostBuckets.flatMap((bucket) => profile.materializeCost[bucket])]
    process.stdout.write("SF_MATERIALIZE_COST " + materializeFields.join(" ") + "\n")
    if ((profile.kind === 3 || profile.kind === 4) && profile.tupleCross) {
      for (let family = 0; family < 3; family++) {
        const crossFields = [...fields.slice(0, 10), family, ...profile.tupleCross.families[family]!.counts]
        process.stdout.write("SF_TUPLE_CROSS_OWNER " + crossFields.join(" ") + "\n")
      }
    }
    let drops = false
    for (let index = 0; index < 16; index++) {
      profile.tupleCrossDrops[index]! += unscopedTupleDrops[index]!
      unscopedTupleDrops[index] = 0
      if (profile.tupleCrossDrops[index]) drops = true
    }
    if (drops) {
      const dropFields = [...fields.slice(0, 10), 3, ...profile.tupleCrossDrops]
      process.stdout.write("SF_TUPLE_CROSS_OWNER " + dropFields.join(" ") + "\n")
    }
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
}
