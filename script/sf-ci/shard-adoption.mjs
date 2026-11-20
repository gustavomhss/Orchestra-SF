import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const PREFIX = "ci-run-linux-sfshard-"
const COUNT = 8
const fail = (message) => { throw new Error("SF_SHARD_ADOPTION: " + message) }
const hash = (value) => createHash("sha256").update(value).digest("hex")
const fileHash = (files) => hash([...files].sort().join("\n"))

function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return "[" + Array.from(value, canonical).join(",") + "]"
  if (value && typeof value === "object" &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}"
  }
  fail("expected plain JSON data")
}

function sha(value, name) {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) fail(name + " must be a full lowercase commit SHA")
  return value
}

function attempt(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) fail("attemptId must be 32 lowercase hex characters")
  return value
}

function checkedPlan(plan) {
  if (!plan || typeof plan !== "object" || plan.schemaVersion !== 1 || plan.suiteId !== "CI-SF" ||
      plan.algorithm !== "LPT" || typeof plan.profileStatus !== "string" || !plan.profileStatus ||
      !Number.isFinite(plan.fallbackSeconds) || plan.fallbackSeconds <= 0 || plan.fallbackSeconds > Number.MAX_SAFE_INTEGER ||
      !Array.isArray(plan.shards) || plan.shards.length !== COUNT) fail("invalid eight-shard CI-SF plan")
  const files = plan.shards.flatMap((part, index) => {
    if (!part || part.index !== index + 1 || !Array.isArray(part.files) || !part.files.length ||
        !Number.isFinite(part.historicalLoadSeconds) || part.historicalLoadSeconds <= 0 || part.historicalLoadSeconds > Number.MAX_SAFE_INTEGER ||
        !Number.isSafeInteger(part.unprofiledFiles) || part.unprofiledFiles < 0 ||
        part.unprofiledFiles > part.files.length) fail("invalid or empty shard")
    for (let i = 0; i < part.files.length; i++) {
      const file = part.files[i]
      if (typeof file !== "string" || !/^[\w./-]+(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file) ||
          file.startsWith("/") || file.startsWith("-") || file.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
        fail("unsafe or foreign test path")
      }
      if (i > 0 && part.files[i - 1] >= file) fail("shard files must be unique and sorted")
    }
    return part.files
  })
  if (new Set(files).size !== files.length) fail("duplicate file across shards")
  if (!Number.isSafeInteger(plan.selectedFiles) || plan.selectedFiles !== files.length ||
      plan.selectedFilesSha256 !== fileHash(files)) fail("selection inventory mismatch")
  // Bind every plan field, including future diagnostic fields, without letting
  // historical costs or this binding become evidence of successful tests.
  return { planSha256: hash(canonical(plan)), files }
}

/** Generate all eight requests together. Publishing uses create-only refs; this function never dispatches CI. */
export function createShardBatch({ sourceSha, attemptId, plan }) {
  sha(sourceSha, "sourceSha")
  attempt(attemptId)
  const checked = checkedPlan(plan)
  const requests = plan.shards.map((part) => ({
    refName: PREFIX + sourceSha + "-" + attemptId + "-" + part.index,
    request: {
      package: "sucafina", directory: "modules/sucafina", runner: "bun",
      args: ["--timeout", "30000", ...part.files],
      env: { ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1" },
      sfShard: {
        schemaVersion: 1, suiteId: "CI-SF", sourceSha, attemptId,
        shardIndex: part.index, shardCount: COUNT,
        planSha256: checked.planSha256, selectedFilesSha256: plan.selectedFilesSha256,
        shardFilesSha256: fileHash(part.files),
      },
    },
  }))
  return {
    manifest: {
      schemaVersion: 1, kind: "sf-ci-shard-batch", scope: "selection-only",
      sourceSha, attemptId, planSha256: checked.planSha256,
      selectedFiles: checked.files.length, selectedFilesSha256: plan.selectedFilesSha256,
      shards: requests.map((entry) => ({
        shardIndex: entry.request.sfShard.shardIndex, refName: entry.refName,
        requestFile: entry.refName + "/.ci-run.json",
        requestSha256: hash(canonical(entry.request)),
        shardFilesSha256: entry.request.sfShard.shardFilesSha256,
      })),
    },
    requests,
  }
}

/**
 * Run on the raw request before normalization. Context must come from the actual
 * checkout and Actions ref, never from request-controlled fields. A managed
 * snapshot may overlay only .ci-run.json on its one reviewed source parent.
 */
export function verifyShardRequest(request, context = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) fail("request must be an object")
  if (!context || typeof context !== "object" || Array.isArray(context)) fail("snapshot context must be an object")
  if (!Object.hasOwn(request, "sfShard")) {
    if (typeof context.refName === "string" && context.refName.startsWith(PREFIX)) fail("managed shard ref requires binding")
    return undefined
  }
  const binding = request.sfShard
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) fail("invalid shard binding")
  sha(binding.sourceSha, "sourceSha")
  attempt(binding.attemptId)
  sha(context.snapshotSha, "snapshotSha")
  if (context.snapshotSha === binding.sourceSha || !Array.isArray(context.parentShas) ||
      context.parentShas.length !== 1 || context.parentShas[0] !== binding.sourceSha) fail("snapshot source drift")
  if (!Array.isArray(context.changedPaths) || context.changedPaths.length !== 1 ||
      context.changedPaths[0] !== ".ci-run.json") fail("snapshot contains non-request changes")
  const batch = createShardBatch({ sourceSha: binding.sourceSha, attemptId: binding.attemptId, plan: context.plan })
  if (binding.planSha256 !== batch.manifest.planSha256) fail("plan drift")
  if (binding.selectedFilesSha256 !== batch.manifest.selectedFilesSha256) fail("selection drift")
  const entry = batch.requests.find((item) => item.request.sfShard.shardIndex === binding.shardIndex)
  if (!entry || context.refName !== entry.refName) fail("branch identity does not match shard attempt")
  if (canonical(request) !== canonical(entry.request)) fail("request differs from the current generated shard")
  return {
    schemaVersion: 1, kind: "sf-ci-shard-binding", scope: "selection-only",
    sourceSha: binding.sourceSha, snapshotSha: context.snapshotSha,
    attemptId: binding.attemptId, shardIndex: binding.shardIndex, shardCount: COUNT,
    refName: entry.refName, planSha256: batch.manifest.planSha256,
    selectedFilesSha256: batch.manifest.selectedFilesSha256,
    shardFilesSha256: binding.shardFilesSha256, requestSha256: hash(canonical(request)),
  }
}

/** Check adoption evidence only; product results still require the existing gate receipts and authentic baselines. */
export function verifyShardBindings(manifest, bindings, plan) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(bindings)) fail("batch manifest and bindings required")
  const batch = createShardBatch({ sourceSha: manifest.sourceSha, attemptId: manifest.attemptId, plan })
  if (canonical(manifest) !== canonical(batch.manifest)) fail("batch manifest differs from the current plan")
  if (bindings.length !== COUNT) fail("all eight bindings required")
  const snapshots = new Set()
  for (const entry of batch.requests) {
    const matching = bindings.filter((item) => item?.shardIndex === entry.request.sfShard.shardIndex)
    if (matching.length !== 1) fail("missing or duplicate shard binding")
    const actual = matching[0]
    sha(actual.snapshotSha, "snapshotSha")
    if (snapshots.has(actual.snapshotSha)) fail("duplicate snapshot identity")
    snapshots.add(actual.snapshotSha)
    const expected = verifyShardRequest(entry.request, {
      plan, snapshotSha: actual.snapshotSha, parentShas: [manifest.sourceSha],
      changedPaths: [".ci-run.json"], refName: entry.refName,
    })
    if (canonical(actual) !== canonical(expected)) fail("binding receipt source, plan or request mismatch")
  }
  return { scope: "selection-only", sourceSha: manifest.sourceSha, attemptId: manifest.attemptId,
    planSha256: manifest.planSha256, selectedFilesSha256: manifest.selectedFilesSha256, bindings: COUNT }
}

function main(argv) {
  const command = argv[0]
  const allowed = command === "generate" ? ["plan", "source", "attempt", "out"]
    : command === "verify" ? ["request", "plan", "context", "out"]
      : command === "verify-batch" ? ["manifest", "bindings", "plan", "out"] : []
  if (!allowed.length || argv.length % 2 !== 1) fail("use generate, verify or verify-batch with named --key value arguments")
  const options = {}
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i].slice(2), value = argv[i + 1]
    if (!argv[i].startsWith("--") || !allowed.includes(key) || Object.hasOwn(options, key) ||
        !value || value.startsWith("--")) fail("unknown, repeated or empty CLI option")
    options[key] = value
  }
  const read = (key) => {
    if (!options[key]) fail("--" + key + " is required")
    return JSON.parse(readFileSync(options[key], "utf8"))
  }
  if (!options.out) fail("--out is required")
  if (command === "generate") {
    const batch = createShardBatch({ sourceSha: options.source, attemptId: options.attempt ?? randomBytes(16).toString("hex"), plan: read("plan") })
    // Exclusive creation refuses accidental reuse or overwrite of a previous attempt.
    mkdirSync(options.out, { mode: 0o700 })
    for (const entry of batch.requests) {
      const directory = path.join(options.out, entry.refName)
      mkdirSync(directory, { mode: 0o700 })
      writeFileSync(path.join(directory, ".ci-run.json"), JSON.stringify(entry.request, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    }
    writeFileSync(path.join(options.out, "batch.json"), JSON.stringify(batch.manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    console.log(JSON.stringify({ scope: "selection-only", sourceSha: batch.manifest.sourceSha,
      attemptId: batch.manifest.attemptId, planSha256: batch.manifest.planSha256, requests: COUNT, dispatched: false }))
    return
  }
  const result = command === "verify"
    ? verifyShardRequest(read("request"), { ...read("context"), plan: read("plan") })
    : verifyShardBindings(read("manifest"), read("bindings"), read("plan"))
  if (!result) fail("request is not a managed shard")
  writeFileSync(options.out, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  console.log(JSON.stringify(result))
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2))
