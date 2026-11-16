// Mission 210: read-only bridge for historical log evidence. No network, no write/delete, no log contents in output.
import { createHash } from "node:crypto"
import { readFile, readdir, lstat } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const archiveIndex = fileURLToPath(new URL("./INDEX-210.json", import.meta.url))
const installedIndex = fileURLToPath(new URL("../../modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/INDEX-210.json", import.meta.url))
const artifactRoot = "modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/"
const allowedText = /\.(json|md|txt|patch|ts|tsx|js|jsx|mjs|cjs|py|sh|yaml|yml|toml|conf|lock|log)$/i

export async function loadIndex(indexPath) {
  const paths = indexPath ? [resolve(indexPath)] : [archiveIndex, installedIndex]
  for (const path of paths) {
    try {
      const index = JSON.parse(await readFile(path, "utf8"))
      checkIndex(index)
      return { index, path }
    } catch (error) {
      if (error?.code === "ENOENT" && path !== paths[paths.length - 1]) continue
      throw error
    }
  }
  throw new Error("archive210 index unavailable")
}

export function checkIndex(index) {
  if (index?.schema !== "sf2h.evidence.archive210.immutable-index.v1" || !Array.isArray(index.logs) || index.logs.length !== 55) {
    throw new Error("not the authorized archive210 index of 55 logs")
  }
  if (!/^[0-9a-f]{40}$/.test(index.source_commit)) throw new Error("invalid historical source commit")
  const paths = new Set()
  const ids = new Set()
  for (const log of index.logs) {
    if (!/^AS-\d{2}$/.test(log.id) || ids.has(log.id)) throw new Error("duplicate/invalid log id")
    if (!/^[0-9a-f]{40}$/.test(log.git_blob_sha) || log.source_commit !== index.source_commit) throw new Error("invalid Git provenance")
    if (!log.original_path.startsWith("modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/") || log.original_path.includes("..") || paths.has(log.original_path)) throw new Error("invalid source path")
    if (!Number.isSafeInteger(log.bytes) || log.bytes < 0 || log.pre_post_delete?.delete_authorized !== false) throw new Error("missing evidence custody constraint")
    paths.add(log.original_path)
    ids.add(log.id)
  }
  return true
}

export function resolveLog(index, idOrOriginalPath) {
  checkIndex(index)
  const log = index.logs.find((item) => item.id === idOrOriginalPath || item.original_path === idOrOriginalPath)
  if (!log) throw new Error("historical source not in archive210 custody")
  return log
}

export function validateGitBlob(log, data) {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data)
  const gitSha = createHash("sha1").update("blob " + bytes.length + "\0", "utf8").update(bytes).digest("hex")
  return {
    id: log.id,
    original_path: log.original_path,
    expected_blob: log.git_blob_sha,
    observed_blob: gitSha,
    expected_bytes: log.bytes,
    observed_bytes: bytes.length,
    sha_matches: gitSha === log.git_blob_sha,
    size_matches: bytes.length === log.bytes,
    historical_provenance_only: true,
  }
}

// GitHub MCP must be supplied by the caller. This module makes no HTTP call and never stores the bytes.
// The provider accepts { repository, git_blob_sha, immutable_blob_uri } and returns a Uint8Array,
// UTF-8 string, or a GitHub MCP fetch_blob response object. Its secret-bearing content is never logged.
export async function readPinnedLog(index, idOrOriginalPath, githubMcpFetchBlob) {
  if (typeof githubMcpFetchBlob !== "function") throw new Error("GitHub MCP blob provider required")
  const log = resolveLog(index, idOrOriginalPath)
  const result = await githubMcpFetchBlob({
    repository: index.root_repo,
    git_blob_sha: log.git_blob_sha,
    immutable_blob_uri: log.retrieval.immutable_blob_uri,
  })
  const data = result?.result?.content ?? result?.content ?? result
  if (!(typeof data === "string" || data instanceof Uint8Array)) throw new Error("unsupported GitHub MCP blob body")
  const witness = validateGitBlob(log, data)
  if (!witness.sha_matches || !witness.size_matches) throw new Error("historical evidence byte/sha mismatch: " + log.id)
  return { bytes: typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data), witness }
}

export async function auditCurrentTree(index, repositoryRoot) {
  const root = resolve(repositoryRoot)
  const records = await Promise.all(index.logs.map(async (log) => {
    try {
      const bytes = await readFile(join(root, log.original_path))
      const witness = validateGitBlob(log, bytes)
      return { id: log.id, path: log.original_path, present: true, sha_matches: witness.sha_matches, size_matches: witness.size_matches, observed_blob: witness.observed_blob }
    } catch (error) {
      if (error?.code === "ENOENT") return { id: log.id, path: log.original_path, present: false, sha_matches: false, size_matches: false, reason: "MISSING_FROM_WORKING_TREE" }
      throw error
    }
  }))
  return { schema: "sf2h.archive210.local-structural-audit.v1", records, all_present_and_identical: records.every((x) => x.present && x.sha_matches && x.size_matches), gate_verdict: "NOT_RUN", delete_authorization: false }
}

export async function scanConsumerReferences(index, repositoryRoot, { maxFileBytes = 4_194_304 } = {}) {
  const root = resolve(repositoryRoot)
  const files = []
  const skipped = []
  const originalLogs = new Set(index.logs.map((log) => log.original_path))
  async function visit(dir) {
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
      if (dirent.name === ".git" || dirent.name === "node_modules") continue
      const full = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        await visit(full)
        continue
      }
      if (!dirent.isFile() || !allowedText.test(dirent.name)) continue
      const path = relative(root, full).split(sep).join("/")
      if (originalLogs.has(path) || path.startsWith(artifactRoot)) continue
      const meta = await lstat(full)
      if (meta.size > maxFileBytes) {
        skipped.push({ path, bytes: meta.size, reason: "MAX_SCAN_BYTES" })
        continue
      }
      const source = await readFile(full, "utf8")
      const refs = index.logs.flatMap((log) => {
        const exactPath = source.includes(log.original_path)
        const exactBlob = source.includes(log.git_blob_sha)
        const basename = log.original_path.slice(log.original_path.lastIndexOf("/") + 1)
        const basenameOnly = !exactPath && !exactBlob && source.includes(basename)
        if (!exactPath && !exactBlob && !basenameOnly) return []
        return [{ id: log.id, match: exactPath ? "EXACT_ORIGINAL_PATH" : exactBlob ? "EXACT_GIT_BLOB_SHA" : "BASENAME_ONLY_UNCONFIRMED" }]
      })
      if (refs.length) files.push({ path, refs })
    }
  }
  await visit(root)
  return {
    schema: "sf2h.archive210.consumer-scan.v1",
    scanned_root: root,
    files,
    skipped,
    scan_finished: skipped.length === 0,
    does_not_prove_absence_of_dynamic_readers: true,
    consumer_equivalence_proven: false,
    guard_verdict: "NOT_RUN",
    deletion_authorized: false,
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!["status", "verify-tree", "scan-consumers"].includes(command)) throw new Error("Usage: node READER-210.mjs status|verify-tree|scan-consumers [--root repo] [--index path]")
  const option = (flag, fallback) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : fallback
  }
  const { index, path } = await loadIndex(option("--index", undefined))
  if (command === "status") {
    console.log(JSON.stringify({ schema: index.schema, logs: index.logs.length, historical_source_commit: index.source_commit, index_path: path, deletion_authorized: false, guard: "NOT_RUN" }))
    return
  }
  const root = option("--root", process.cwd())
  const output = command === "verify-tree" ? await auditCurrentTree(index, root) : await scanConsumerReferences(index, root)
  console.log(JSON.stringify(output, null, 2))
  if (command === "verify-tree" && !output.all_present_and_identical) process.exitCode = 2
  if (command === "scan-consumers" && !output.scan_finished) process.exitCode = 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("archive210 reader failed:", error?.message ?? "unknown")
    process.exitCode = 1
  })
}
