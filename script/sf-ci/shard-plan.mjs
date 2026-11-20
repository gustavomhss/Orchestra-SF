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

const v2ProfileKeys = new Set([
  "schemaVersion", "status", "unit", "measurement", "pathPrefix", "fallbackSeconds", "minimumObservedSeconds",
  "sourceCount", "observedFiles", "weightedFiles", "sources", "exclusionsFromCostProfile", "costs",
])
const v2SourceKeys = new Set([
  "id", "runId", "runAttempt", "jobName", "jobId", "headSha", "suiteId", "directory", "status",
  "conclusionScope", "partial", "observedFiles", "passedTests", "failedTests", "skippedTests",
  "reportSha256", "shardIndex", "shardCount",
])

function observedSource(source) {
  if (Object.keys(source).some((key) => !v2SourceKeys.has(key)) ||
      !Number.isSafeInteger(source.runAttempt) || source.runAttempt < 1 ||
      typeof source.jobName !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(source.jobName) ||
      (source.jobId !== undefined && (!Number.isSafeInteger(source.jobId) || source.jobId < 1)) ||
      typeof source.suiteId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(source.suiteId) ||
      typeof source.reportSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.reportSha256) ||
      !["test-step", "test-command"].includes(source.conclusionScope) ||
      !["success", "failure", "cancelled", "timed_out"].includes(source.status) ||
      !Number.isSafeInteger(source.skippedTests) || source.skippedTests < 0) {
    fail("invalid observed source provenance")
  }
  if (source.directory !== ".") relativePath(source.directory)
  if ((source.shardIndex === undefined) !== (source.shardCount === undefined) ||
      (source.shardIndex !== undefined && (!Number.isSafeInteger(source.shardIndex) ||
        !Number.isSafeInteger(source.shardCount) || source.shardIndex < 1 || source.shardIndex > source.shardCount))) {
    fail("invalid source shard identity")
  }
  const tests = source.passedTests + source.failedTests + source.skippedTests
  if (!Number.isSafeInteger(tests) || source.observedFiles > tests ||
      (source.status === "success" && (source.failedTests !== 0 || source.passedTests < 1 || source.observedFiles < 1)) ||
      (source.status !== "success" && !source.partial) || (source.skippedTests > 0 && !source.partial)) {
    fail("source conclusion or completeness contradicts observations")
  }
}

/** Read advisory load hints only. Neither schema is an acceptance receipt or a selection inventory. */
export function parseShardCosts(profile) {
  const observed = profile?.schemaVersion === 2
  if ((!observed && profile?.schemaVersion !== 1) ||
      profile.status !== (observed ? "OBSERVED_TIMINGS" : "HISTORICAL_RED_OR_PARTIAL") || profile.unit !== "seconds") {
    fail("unsupported cost profile")
  }
  if (observed && (profile.measurement !== "junit-case-seconds" ||
      Object.keys(profile).some((key) => !v2ProfileKeys.has(key)))) fail("invalid observed profile fields")
  if (typeof profile.pathPrefix !== "string" || !profile.pathPrefix.endsWith("/")) fail("missing path prefix")
  relativePath(profile.pathPrefix.slice(0, -1))
  const fallbackSeconds = seconds(profile.fallbackSeconds)
  const minimum = seconds(profile.minimumObservedSeconds)
  if (!Array.isArray(profile.sources) || !profile.sources.length || !Array.isArray(profile.costs) ||
      !Array.isArray(profile.exclusionsFromCostProfile)) fail("missing profile arrays")
  if (profile.sourceCount !== profile.sources.length || profile.weightedFiles !== profile.costs.length ||
      !Number.isSafeInteger(profile.observedFiles) || profile.observedFiles < profile.costs.length) fail("profile count mismatch")
  const sources = new Set()
  const observations = new Set()
  const remaining = new Map()
  for (const source of profile.sources) {
    if (!source || typeof source !== "object" || Array.isArray(source) ||
        typeof source.id !== "string" || !/^[a-z0-9-]+$/.test(source.id) || sources.has(source.id) ||
        !Number.isSafeInteger(source.runId) || source.runId < 1 ||
        typeof source.headSha !== "string" || !/^[a-f0-9]{40}$/.test(source.headSha) || typeof source.partial !== "boolean" ||
        !["observedFiles", "passedTests", "failedTests"].every((key) => Number.isSafeInteger(source[key]) && source[key] >= 0)) {
      fail("invalid or duplicate source provenance")
    }
    if (observed) {
      observedSource(source)
      const identity = JSON.stringify([source.runId, source.runAttempt, source.jobName, source.suiteId, source.shardIndex ?? null])
      if (observations.has(identity)) fail("duplicate observed execution")
      observations.add(identity)
      remaining.set(source.id, source.observedFiles)
    } else if (!Number.isSafeInteger(source.jobId) || source.jobId < 1 ||
        !["failure", "cancelled", "in_progress"].includes(source.status)) {
      fail("invalid historical source provenance")
    }
    sources.add(source.id)
  }
  if (observed && new Set(profile.sources.map((source) => JSON.stringify([source.suiteId, source.directory]))).size !== 1) {
    fail("mixed suite or directory observations")
  }
  if (profile.sources.reduce((total, source) => total + source.observedFiles, 0) !== profile.observedFiles) fail("source file count mismatch")
  // These entries invalidate old timings after structural changes; they do not
  // remove files. planShards receives no exclusion set and assigns fallback cost.
  const excluded = new Set()
  for (const item of profile.exclusionsFromCostProfile) {
    const file = relativePath(item?.path)
    if ((observed && Object.keys(item).some((key) => !["path", "reason"].includes(key))) ||
        item.reason !== "STRUCTURE_CHANGED" || excluded.has(file)) fail("invalid or duplicate timing exclusion")
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
    if (observed) {
      const left = remaining.get(row[2]) - 1
      if (left < 0) fail("cost rows exceed source observations")
      remaining.set(row[2], left)
    }
    weights.set(file, cost)
  }
  return { weights, fallbackSeconds, profileStatus: profile.status }
}

/**
 * Deterministic longest-processing-time assignment. Input files alone define
 * coverage. Observed costs (including red/partial history) and fallback values
 * are scheduling hints, not evidence receipts or predicted wall time.
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
