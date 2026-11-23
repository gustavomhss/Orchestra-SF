import { AsyncLocalStorage } from "node:async_hooks"

// Snapshot-only aggregate timing. No request, reference, authority value or producer result is retained.
// Each row has schema, owner, parent, depth, fulfilled, epochMs, elapsedUs, activeAsync,
// then count/elapsedUs pairs in this order. Timings are inclusive and must not be summed across nesting.
const buckets = ["finance-current","finance-reader-identities","finance-environment","finance-witness-before","finance-witness-after","finance-witness-egress","finance-closed-pair","finance-snapshot-digest","finance-materialized","finance-authorize-records","finance-work","finance-authenticate","finance-revalidate","root-pinned","root-current","root-healthy","root-native-lookup","root-native-current","root-owner-current","root-request-identity","root-binding-digest","proof-frame-current","proof-readers-current","proof-owner-current","proof-unchanged","proof-refs-digest","proof-leaf-current","proof-canonical","proof-clone"] as const
type Bucket = typeof buckets[number]
type Profile = {
  id: number
  parent: number
  depth: number
  started: number
  epoch: number
  active: number
  closed: boolean
  values: Record<Bucket, [number, number]>
}
const profiles = new AsyncLocalStorage<Profile>()
let sequence = 0

export function sfPlannerCost<Value>(bucket: Bucket, read: () => Value): Value {
  const profile = profiles.getStore()
  if (!profile || profile.closed) return read()
  const started = performance.now()
  profile.values[bucket][0]++
  try { return read() }
  finally { profile.values[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000)) }
}

/** Attach a passive settlement observer and return the exact original Promise. */
export function sfPlannerAsyncCost<Value>(bucket: Bucket, read: () => Promise<Value>): Promise<Value> {
  const profile = profiles.getStore()
  if (!profile || profile.closed) return read()
  const started = performance.now()
  profile.values[bucket][0]++
  profile.active++
  const settled = () => {
    profile.values[bucket][1] += Math.max(0, Math.round((performance.now() - started) * 1000))
    profile.active--
  }
  let pending: Promise<Value>
  try { pending = read() } catch (error) { settled(); throw error }
  void pending.then(settled, settled)
  return pending
}

/** One numeric row per Finance callback settlement, not per fence or product success. */
export function sfPlannerCostOwner<Value>(work: () => Promise<Value>): Promise<Value> {
  const parent = profiles.getStore()
  const profile: Profile = {
    id: ++sequence, parent: parent?.id ?? 0, depth: parent ? parent.depth + 1 : 0,
    started: performance.now(), epoch: Date.now(), active: 0, closed: false,
    values: Object.fromEntries(buckets.map((bucket) => [bucket, [0, 0]])) as Record<Bucket, [number, number]>,
  }
  return profiles.run(profile, () => {
    let pending: Promise<Value>
    try { pending = work() } catch (error) { emit(profile, 0); throw error }
    void pending.then(() => emit(profile, 1), () => emit(profile, 0))
    return pending
  })
}

function emit(profile: Profile, fulfilled: 0 | 1) {
  if (profile.closed) return
  profile.closed = true
  try {
    const fields = [1, profile.id, profile.parent, profile.depth, fulfilled, profile.epoch,
      Math.max(0, Math.round((performance.now() - profile.started) * 1000)), profile.active,
      ...buckets.flatMap((bucket) => profile.values[bucket])]
    process.stdout.write("SF_PLANNER_COST " + fields.join(" ") + "\n")
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
}
