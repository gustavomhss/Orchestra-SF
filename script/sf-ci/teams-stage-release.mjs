import { constants } from "node:fs"
import { chmod, lstat, mkdir, open, realpath, rm } from "node:fs/promises"
import path from "node:path"
import { hash, parseCanonicalJson, safePath } from "./team-profile-residue.mjs"
import { verifyTeamsInstalledRelease } from "./teams-installed-release.mjs"

class Refusal extends Error {}
function fail(reason) {
  throw new Refusal("TEAMS_STAGE_RELEASE_FAIL_CLOSED: " + reason)
}

const statOptions = { bigint: true }
const privateMode = 0o700
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const token = (value) => typeof value === "string" && /^[\x21-\x7e]+$/.test(value)
const modeOf = (info) => Number(info.mode & 0o7777n)

// Offline only. The caller must have passed these exact readTarArchive records
// to a successful verifyArtifact call. Use a dedicated private POSIX parent;
// the caller must keep its namespace (including ancestors) stable and ensure
// no filesystem ACL grants extra access. Staging does not activate the release.
export async function stageVerifiedTeamsRelease({ destination, files }) {
  let created = false, root, parent, parentPath
  try {
    if (process.platform === "win32" || !process.geteuid || !constants.O_NOFOLLOW || !constants.O_NONBLOCK)
      fail("storage does not support required POSIX checks")
    if (typeof destination !== "string" || !path.isAbsolute(destination) || destination === "/" ||
        path.resolve(destination) !== destination || /[\\\x00-\x1f\x7f]/.test(destination))
      fail("destination must be an absolute normalized path")

    const { entries, directories, executables } = prepareArchive(files)
    parentPath = path.dirname(destination)
    parent = await privateParent(parentPath)

    // Never adopt a previous directory, even if fully identical. mkdir itself
    // makes the absence check exclusive, including for concurrent callers.
    try {
      await mkdir(destination, { mode: privateMode })
    } catch (error) {
      if (error?.code === "EEXIST") fail("destination already exists")
      throw error
    }
    created = true
    root = await lstat(destination, statOptions)
    if (!root.isDirectory() || root.dev !== parent.dev || root.uid !== parent.uid)
      fail("unexpected destination storage")
    // mkdir applies umask. Restore owner bits only, without changing umask.
    if (modeOf(root) !== privateMode) await chmod(destination, privateMode)
    for (const member of directories) {
      const directory = path.join(destination, member)
      await mkdir(directory, { mode: privateMode })
      await chmod(directory, privateMode)
    }

    for (const file of entries.values()) {
      const handle = await open(path.join(destination, file.path),
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      try {
        await handle.writeFile(file.data)
        await handle.chmod(executables.has(file.path) ? 0o700 : 0o600)
      } finally {
        await handle.close()
      }
    }

    const proof = await verifyTeamsInstalledRelease({ releaseRoot: destination, files: [...entries.values()] })
    const current = await lstat(destination, statOptions)
    if (!sameDirectory(root, current) || current.uid !== parent.uid || modeOf(current) !== privateMode ||
        !sameDirectory(parent, await privateParent(parentPath)))
      fail("destination or parent changed during staging")
    return proof
  } catch (error) {
    if (created) {
      try {
        if (!sameDirectory(parent, await privateParent(parentPath)))
          fail("destination parent changed")
        const current = await lstat(destination, statOptions).catch((error) => {
          if (error?.code !== "ENOENT") throw error
        })
        if (current) {
          if (!sameDirectory(root, current)) fail("destination identity changed")
          await rm(destination, { recursive: true })
        }
      } catch {
        fail("staging failed and rollback could not be confirmed")
      }
    }
    if (error instanceof Refusal) throw error
    fail("could not stage and verify release")
  }
}

async function privateParent(directory) {
  const info = await lstat(directory, statOptions).catch((error) => {
    if (error?.code !== "ENOENT") throw error
  })
  if (!info?.isDirectory() || info.uid !== BigInt(process.geteuid()) || modeOf(info) !== privateMode ||
      await realpath(directory) !== directory)
    fail("destination parent must be an existing canonical owner-only directory (0700)")
  return info
}

function sameDirectory(before, after) {
  return before?.isDirectory() && after.isDirectory() && before.dev === after.dev && before.ino === after.ino
}

function requireMemberPath(member) {
  // Same portable member grammar as the producer and installed verifier.
  try { safePath(member) } catch { fail("unsafe archive member path") }
  if (!/^[\x20-\x7e]+$/.test(member) || /[\\:<>"|?*]/.test(member) ||
      member.split("/").some((part) => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part)))
    fail("unsafe archive member path")
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function prepareArchive(files) {
  if (!Array.isArray(files) || !files.length) fail("missing archive file roster")
  const entries = new Map(), directories = new Set(), spellings = new Map()
  for (const file of files) {
    if (!file || typeof file !== "object") fail("invalid archive file record")
    const { domain, path: member, byteLength, sha256: digest, data } = file
    if (domain !== "archive" || !Number.isSafeInteger(byteLength) || byteLength < 0 || !sha256(digest) || !Buffer.isBuffer(data))
      fail("invalid archive file record")
    requireMemberPath(member)
    if (entries.has(member)) fail("duplicate archive file record")
    // Reject case aliases up front, including directories on case-folding storage.
    let prefix = ""
    for (const part of member.split("/")) {
      prefix = prefix ? `${prefix}/${part}` : part
      const key = prefix.toLowerCase()
      if (spellings.has(key) && spellings.get(key) !== prefix) fail("archive member paths differ only by case")
      spellings.set(key, prefix)
      if (prefix !== member) directories.add(prefix)
    }

    // Isolate the exact validated bytes and metadata from mutation during awaits.
    if (data.length !== byteLength) fail("archive data length differs from file record")
    const bytes = Buffer.from(data)
    if (hash(bytes) !== digest) fail("archive data hash differs from file record")
    entries.set(member, { domain, path: member, byteLength, sha256: digest, data: bytes })
  }
  for (const directory of directories) {
    if (entries.has(directory)) fail("archive file overlaps a directory")
  }

  const manifest = entries.get("distribution.json")
  if (!manifest || !entries.has("checksums.sha256")) fail("missing embedded distribution companions")
  let descriptor
  try { descriptor = parseCanonicalJson(manifest.data, "embedded distribution") } catch { fail("invalid embedded distribution descriptor") }
  if (!exactKeys(descriptor, ["schema", "version", "target", "files"]) || descriptor.schema !== "orchestra-distribution-v1" ||
      !token(descriptor.version) || !token(descriptor.target) || !Array.isArray(descriptor.files) || !descriptor.files.length ||
      entries.size !== descriptor.files.length + 2)
    fail("invalid embedded distribution descriptor")

  const executables = new Set()
  let previous = ""
  for (const row of descriptor.files) {
    if (!exactKeys(row, ["path", "sha256", "executable"]) || !sha256(row.sha256) || typeof row.executable !== "boolean")
      fail("invalid embedded distribution entry")
    requireMemberPath(row.path)
    if (row.path !== "package.json" && !row.path.startsWith("bin/")) fail("invalid distribution payload path")
    if (row.path <= previous || entries.get(row.path)?.sha256 !== row.sha256)
      fail("embedded distribution roster differs from archive")
    if (row.executable) executables.add(row.path)
    previous = row.path
  }
  return { entries, directories, executables }
}
