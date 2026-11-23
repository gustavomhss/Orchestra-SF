// Diagnostic snapshot only. Never promote this module or its instrumentation.
type C17CostBucket = "observe" | "sourceIdentities" | "prepareAclClone" | "prepareFullClone" |
  "observeScopeClone" | "projectorSnapshotClone" | "projectorScopeClone" | "projectScope" |
  "authorizeFirst" | "authorizeSecond" | "schemaOutputClone" | "digestSfValue" |
  "canonicalSfValue" | "captureRuntimeCurrent" | "projectionRuntimeCurrent" | "contextIdentityPreparation" |
  "schemaOutputValidation" | "localMaterializeSnapshot" | "localDecodeSnapshot" | "localCloneSnapshot" |
  "localAuthorityAclGuard" | "localPhysicalGuard"
type Cost = { calls: number; milliseconds: number; maximum: number; reportedCalls: number; reportedMilliseconds: number }
let profile: { fixture: string; started: number; costs: Map<C17CostBucket, Cost> } | undefined

export function beginC17CostProfile(fixture: string) {
  profile = { fixture, started: performance.now(), costs: new Map() }
}

export function endC17CostProfile() {
  profile = undefined
}

/** A start/end pair also brackets an existing await without changing its promise. */
export function startC17Cost(bucket: C17CostBucket): number | undefined {
  if (!profile) return undefined
  let cost = profile.costs.get(bucket)
  if (!cost) {
    cost = { calls: 0, milliseconds: 0, maximum: 0, reportedCalls: 0, reportedMilliseconds: 0 }
    profile.costs.set(bucket, cost)
  }
  cost.calls++
  return performance.now()
}

export function finishC17Cost(bucket: C17CostBucket, started: number | undefined) {
  if (started === undefined || !profile) return
  const elapsed = performance.now() - started
  const cost = profile.costs.get(bucket)
  if (!cost) return
  cost.milliseconds += elapsed
  if (elapsed > cost.maximum) cost.maximum = elapsed
}

/** The caller evaluates its original clone function and argument in that order. */
export function copyC17Cost<Value>(bucket: C17CostBucket, copy: (value: Value) => Value, value: Value): Value {
  const started = startC17Cost(bucket)
  try { return copy(value) }
  finally { finishC17Cost(bucket, started) }
}

export function reportC17CostPhase(fixture: string, phase: string) {
  if (!profile || profile.fixture !== fixture) return
  const observed = profile
  const counters = [...observed.costs].flatMap(([bucket, cost]) => {
    const calls = cost.calls - cost.reportedCalls
    const milliseconds = cost.milliseconds - cost.reportedMilliseconds
    const maximum = cost.maximum
    cost.reportedCalls = cost.calls
    cost.reportedMilliseconds = cost.milliseconds
    cost.maximum = 0
    return calls ? [{ bucket, calls, milliseconds: Math.round(milliseconds * 1000) / 1000,
      maximumMs: Math.round(maximum * 1000) / 1000 }] : []
  })
  console.info("SF_C17_COST_PROFILE", JSON.stringify({
    schema: "sf-c17-cost-v2", qualification: false, source: "97c921ab0054bd5154227593adcbcca56b0538c3",
    sourceTree: "3f04bc2f32be61ea4596b2d8c008c3f944e5841b", fixture, phase,
    runtime: { version: Bun.version, revision: Bun.revision }, clock: "performance.now",
    timing: "inclusive elapsed; nested buckets and awaits overlap; instrumentation overhead is present",
    elapsedMs: Math.round(performance.now() - observed.started), counters,
  }))
}
