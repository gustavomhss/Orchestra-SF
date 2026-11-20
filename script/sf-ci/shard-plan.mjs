const fail = (message) => { throw new Error("SF_CI_FAIL_CLOSED: shard plan: " + message) }

function relativePath(value) {
  if (typeof value !== "string" || !value || !/^[a-zA-Z0-9_./-]+$/.test(value) ||
      value.startsWith("/") || value.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("unsafe relative path: " + String(value))
  }
  return value
}

function seconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    fail("cost must be a positive finite safe number")
  }
  return value
}

/** Read historical load hints only. The profile is never a selection inventory. */
export function parseShardCosts(profile) {
  if (profile?.schemaVersion !== 1 || profile.status !== "HISTORICAL_RED_OR_PARTIAL" || profile.unit !== "seconds") {
    fail("unsupported historical cost profile")
  }
  if (typeof profile.pathPrefix !== "string" || !profile.pathPrefix.endsWith("/")) fail("missing path prefix")
  relativePath(profile.pathPrefix.slice(0, -1))
  const fallbackSeconds = seconds(profile.fallbackSeconds)
  const minimum = seconds(profile.minimumObservedSeconds)
  if (!Array.isArray(profile.sources) || !profile.sources.length || !Array.isArray(profile.costs) ||
      !Array.isArray(profile.exclusionsFromCostProfile)) fail("missing profile arrays")
  if (profile.sourceCount !== profile.sources.length || profile.weightedFiles !== profile.costs.length ||
      !Number.isSafeInteger(profile.observedFiles) || profile.observedFiles < profile.costs.length) fail("profile count mismatch")
  const sources = new Set()
  for (const source of profile.sources) {
    if (!source || typeof source.id !== "string" || !/^[a-z0-9-]+$/.test(source.id) || sources.has(source.id) ||
        !Number.isSafeInteger(source.runId) || source.runId < 1 || !Number.isSafeInteger(source.jobId) || source.jobId < 1 ||
        typeof source.headSha !== "string" || !/^[a-f0-9]{40}$/.test(source.headSha) || typeof source.partial !== "boolean" ||
        !["failure", "cancelled", "in_progress"].includes(source.status) ||
        !["observedFiles", "passedTests", "failedTests"].every((key) => Number.isSafeInteger(source[key]) && source[key] >= 0)) {
      fail("invalid or duplicate source provenance")
    }
    sources.add(source.id)
  }
  if (profile.sources.reduce((total, source) => total + source.observedFiles, 0) !== profile.observedFiles) fail("source file count mismatch")
  // These entries invalidate old timings after structural changes; they do not
  // remove files. planShards receives no exclusion set and assigns fallback cost.
  const excluded = new Set()
  for (const item of profile.exclusionsFromCostProfile) {
    const file = relativePath(item?.path)
    if (item.reason !== "STRUCTURE_CHANGED" || excluded.has(file)) fail("invalid or duplicate timing exclusion")
    excluded.add(file)
  }
  const weights = new Map()
  for (const row of profile.costs) {
    if (!Array.isArray(row) || row.length !== 3) fail("cost row must be [path, seconds, source]")
    const file = profile.pathPrefix + relativePath(row[0])
    relativePath(file)
    const cost = seconds(row[1])
    if (cost < minimum || !sources.has(row[2]) || weights.has(file) || excluded.has(file)) {
      fail("invalid, duplicate or invalidated historical cost: " + file)
    }
    weights.set(file, cost)
  }
  return { weights, fallbackSeconds }
}

/**
 * Deterministic longest-processing-time assignment. Input files alone define
 * coverage. Historical red/partial costs and fallback values are scheduling
 * hints, not successful runtimes, evidence receipts or predicted wall time.
 */
export function planShards(files, count, options = {}) {
  if (!Array.isArray(files) || !files.length) fail("empty or invalid file selection")
  if (!Number.isSafeInteger(count) || count < 1 || count > files.length) fail("invalid shard count for selection")
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("invalid planning options")
  const fallback = seconds(options.fallbackSeconds === undefined ? 10 : options.fallbackSeconds)
  const weights = options.weights === undefined ? new Map() : options.weights
  if (!(weights instanceof Map)) fail("weights must be a Map")
  for (const [file, cost] of weights) {
    relativePath(file)
    seconds(cost)
  }
  const selected = Array.from(files, relativePath).sort()
  if (new Set(selected).size !== selected.length) fail("duplicate selected file")
  const ordered = selected.map((file) => ({ file, cost: weights.get(file) ?? fallback }))
    .sort((left, right) => right.cost - left.cost || (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  const shards = Array.from({ length: count }, () => ({ files: [], loadSeconds: 0, unprofiledFiles: 0 }))
  for (const entry of ordered) {
    let target = 0
    for (let index = 1; index < count; index++) {
      if (shards[index].loadSeconds < shards[target].loadSeconds) target = index
    }
    const next = shards[target].loadSeconds + entry.cost
    if (!Number.isFinite(next) || next > Number.MAX_SAFE_INTEGER) fail("shard cost overflow")
    shards[target].files.push(entry.file)
    shards[target].loadSeconds = next
    if (!weights.has(entry.file)) shards[target].unprofiledFiles++
  }
  for (const shard of shards) shard.files.sort()
  const union = shards.flatMap((shard) => shard.files).sort()
  if (shards.some((shard) => !shard.files.length) || union.length !== selected.length ||
      new Set(union).size !== selected.length || union.some((file, index) => file !== selected[index])) {
    fail("partition is not a nonempty, complete disjoint cover")
  }
  return shards
}
