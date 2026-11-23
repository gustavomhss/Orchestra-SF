import { AsyncLocalStorage } from "node:async_hooks"

// Snapshot-only counters: no request, reference, authority value or producer result is retained.
// Kinds: 0 Finance pair, 1 case read, 2 Recall. Parent is zero or parent kind + 1.
// Settlement is Promise fulfillment, not a product success verdict; duration is inclusive microseconds.
const keys = ["rootEntries","nativeProofs","rootOpaque","rootInherited","rootUnsupported","runs","admitted","scopeOpen","scopeClosed","hits","misses","stored","unscoped","noProof","readersFallback","runRefused","leafRefused","ownerIneligible","ownerSelectionFallback","ownerForeign","ownerUnsupported","ownerPreparedFailed","ownerProofMissing","ownerChild","ownerPlanFallback","ownerRefused"] as const
type Counter = typeof keys[number]
// Bound progress to 11 power-of-two milestones per selected counter and owner.
const progressCounters = new Set<Counter>(["nativeProofs","admitted","hits","noProof","readersFallback","runRefused","leafRefused","ownerIneligible","ownerSelectionFallback","ownerForeign","ownerUnsupported","ownerPreparedFailed","ownerProofMissing","ownerPlanFallback","ownerRefused"])
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
  if (!profile) return
  const value = ++profile.counters[key]
  if (progressProfile(profile) && progressCounters.has(key) && value <= 1024 && (value & (value - 1)) === 0)
    emitProgress(profile, 1, keys.indexOf(key) + 1, value)
}

/** Observe settlement, returning the original Promise without a new await. */
export function sfPlannerProofOwner<Value>(kind: 0 | 1 | 2, work: () => Promise<Value>): Promise<Value> {
  const parent = profiles.getStore()
  const profile: SfPlannerProofDiagnostic = {
    kind, parent: parent ? parent.kind + 1 : 0, depth: parent ? parent.depth + 1 : 0,
    started: performance.now(), counters: Object.fromEntries(keys.map((key) => [key, 0])) as Record<Counter, number>,
  }
  return profiles.run(profile, () => {
    emitProgress(profile, 0, 0, 0)
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

function progressProfile(profile: SfPlannerProofDiagnostic) {
  return profile.kind === 2 || profile.kind === 1 && profile.parent === 3
}

// Progress: version, kind, parent, depth, event (entry/milestone), elapsed us, counter ordinal, value.
function emitProgress(profile: SfPlannerProofDiagnostic, event: 0 | 1, counter: number, value: number) {
  try {
    const fields = [1, profile.kind, profile.parent, profile.depth, event,
      Math.round((performance.now() - profile.started) * 1000), counter, value]
    process.stdout.write("SF_PLANNER_PROGRESS " + fields.join(" ") + "\n")
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
}

// Fixed witness sites only; no domain inputs or guard evaluations enter this record.
export function sfPlannerProofStage(stage: number): void {
  const profile = profiles.getStore()
  if (!profile || !progressProfile(profile)) return
  try {
    const fields = [profile.kind, profile.parent, profile.depth, stage,
      Math.round((performance.now() - profile.started) * 1000)]
    process.stdout.write("SF_PLANNER_STAGE " + fields.join(" ") + "\n")
  } catch { /* A diagnostic sink cannot replace the original result or error. */ }
}
