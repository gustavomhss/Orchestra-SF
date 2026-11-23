import { AsyncLocalStorage } from "node:async_hooks"

// Snapshot-only counters: no request, reference, authority value or producer result is retained.
// Kinds: 0 Finance pair, 1 case read, 2 Recall. Parent is zero or parent kind + 1.
// Settlement is Promise fulfillment, not a product success verdict; duration is inclusive microseconds.
const keys = ["rootEntries","nativeProofs","rootOpaque","rootInherited","rootUnsupported","runs","admitted","scopeOpen","scopeClosed","hits","misses","stored","unscoped","noProof","readersFallback","runRefused","leafRefused","ownerIneligible","ownerSelectionFallback","ownerForeign","ownerUnsupported","ownerPreparedFailed","ownerProofMissing","ownerChild","ownerPlanFallback","ownerRefused"] as const
type Counter = typeof keys[number]
export type SfPlannerProofDiagnostic = {
  kind: 0 | 1 | 2
  parent: number
  depth: number
  started: number
  counters: Record<Counter, number>
}
const profiles = new AsyncLocalStorage<SfPlannerProofDiagnostic>()

export function currentSfPlannerProofDiagnostic() { return profiles.getStore() ?? null }
export function sfPlannerProofCount(key: Counter, profile = currentSfPlannerProofDiagnostic()) {
  if (profile) profile.counters[key]++
}

/** Observe settlement, returning the original Promise without a new await. */
export function sfPlannerProofOwner<Value>(kind: 0 | 1 | 2, work: () => Promise<Value>): Promise<Value> {
  const parent = profiles.getStore()
  const profile: SfPlannerProofDiagnostic = {
    kind, parent: parent ? parent.kind + 1 : 0, depth: parent ? parent.depth + 1 : 0,
    started: performance.now(), counters: Object.fromEntries(keys.map((key) => [key, 0])) as Record<Counter, number>,
  }
  return profiles.run(profile, () => {
    const pending = work()
    void pending.then(() => emit(profile, 1), () => emit(profile, 0))
    return pending
  })
}

function emit(profile: SfPlannerProofDiagnostic, fulfilled: 0 | 1) {
  try {
    const fields = [1, profile.kind, profile.parent, profile.depth, fulfilled,
      Math.round((performance.now() - profile.started) * 1000), ...keys.map((key) => profile.counters[key])]
    process.stdout.write("SF_PLANNER_PROOF " + fields.join(" ") + "\n")
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
}
