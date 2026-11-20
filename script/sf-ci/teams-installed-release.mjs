import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { lstat, open, readdir, readlink, realpath, stat } from "node:fs/promises"
import path from "node:path"
import { hash, parseCanonicalJson, safePath } from "./team-profile-residue.mjs"

class Refusal extends Error {}
function fail(reason) {
  throw new Refusal("TEAMS_INSTALLED_RELEASE_FAIL_CLOSED: " + reason)
}

const statOptions = { bigint: true }
const unsafeMode = 0o7022n // Special mode bits or write access for group/other.
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const token = (value) => typeof value === "string" && /^[\x21-\x7e]+$/.test(value)

// Requires verifyArtifact to have accepted these exact readTarArchive records.
// The namespace (including ancestors) must be stable during the walk. This is
// a byte/mode observation, not a process identity or live filesystem snapshot.
export async function verifyTeamsInstalledRelease({ releaseRoot, files }) {
  try {
    if (process.platform === "win32" || !constants.O_NOFOLLOW || !constants.O_NONBLOCK)
      fail("storage does not support required POSIX checks")
    if (typeof releaseRoot !== "string" || !path.isAbsolute(releaseRoot) || releaseRoot === "/" ||
        path.resolve(releaseRoot) !== releaseRoot || /[\\\x00-\x1f\x7f]/.test(releaseRoot) ||
        await realpath(releaseRoot) !== releaseRoot)
      fail("release root is not canonical")

    const expected = archiveRoster(files)
    const directories = new Set()
    for (const relative of expected.keys()) {
      for (let parent = path.posix.dirname(relative); parent !== "."; parent = path.posix.dirname(parent)) {
        if (expected.has(parent)) fail("archive file overlaps a directory")
        directories.add(parent)
      }
    }

    const root = await lstat(releaseRoot, statOptions)
    const seenDirectories = new Set()
    const observed = new Map()
    const scratch = Buffer.alloc(64 * 1024)
    async function walk(relative, directory, before) {
      if (!before.isDirectory() || before.dev !== root.dev || (before.mode & unsafeMode) || seenDirectories.has(before.ino))
        fail("unsafe directory storage")
      seenDirectories.add(before.ino)
      for (const name of await readdir(directory)) {
        const member = relative ? `${relative}/${name}` : name
        requireMemberPath(member)
        const filename = path.join(directory, name)
        const info = await lstat(filename, statOptions)
        if (info.isSymbolicLink()) fail("symbolic link in release")
        if (info.isDirectory()) {
          if (!directories.has(member)) fail("unlisted directory in release")
          await walk(member, filename, info)
          continue
        }
        if (!info.isFile() || info.dev !== root.dev || (info.mode & unsafeMode)) fail("unsafe file storage")
        if (info.nlink !== 1n) fail("multiply linked file in release")
        const entry = expected.get(member)
        if (!entry) fail("unlisted file in release")
        observed.set(member, await verifyFile(filename, info, entry, scratch))
      }
      if (!sameStat(before, await lstat(directory, statOptions))) fail("directory changed during verification")
    }

    await walk("", releaseRoot, root)
    if (await realpath(releaseRoot) !== releaseRoot) fail("release root changed during verification")
    if (observed.size !== expected.size) fail("missing file in release")
    // Canonical JSON: path order, fixed row keys, no host-specific metadata.
    const roster = [...observed.keys()].sort().map((member) => observed.get(member))
    return {
      proofClass: "INSTALLED_RELEASE_BYTES_MATCH_ARCHIVE_ONLY",
      installedClosureSha256: hash(JSON.stringify(roster)),
    }
  } catch (error) {
    if (error instanceof Refusal) throw error
    // Filesystem and JSON errors may contain raw paths or input text.
    fail("could not read release or embedded distribution")
  }
}

// The caller supplies the PID from the trusted service supervisor. This does
// not establish the service configuration, web root, data mount, or auth mode.
export async function verifyTeamsRunningExecutable({ releaseRoot, files, pid }) {
  if (process.platform !== "linux" || !Number.isSafeInteger(pid) || pid < 1)
    fail("Linux service PID required")
  const executable = path.join(releaseRoot, "bin/orchestra")
  const processExecutable = `/proc/${pid}/exe`
  const observe = async () => {
    if (await readlink(processExecutable) !== executable) fail("running executable is not the release binary")
    const [live, installed] = await Promise.all([stat(processExecutable, statOptions), lstat(executable, statOptions)])
    if (!live.isFile() || !installed.isFile() || !sameStat(live, installed)) fail("running executable inode differs from release")
    return live
  }
  try {
    const before = await observe()
    const release = await verifyTeamsInstalledRelease({ releaseRoot, files })
    if (!sameStat(before, await observe())) fail("running executable changed during verification")
    return {
      proofClass: "RUNNING_EXECUTABLE_MATCHES_ARCHIVE_ONLY",
      installedClosureSha256: release.installedClosureSha256,
      executableSha256: files.find((file) => file.path === "bin/orchestra").sha256,
    }
  } catch (error) {
    if (error instanceof Refusal) throw error
    fail("could not observe running release executable")
  }
}

function requireMemberPath(member) {
  try { safePath(member) } catch { fail("unsafe member path") }
  // Match the distribution producer's portable path rules as well as tar safety.
  if (!/^[\x20-\x7e]+$/.test(member) || /[\\:<>"|?*]/.test(member) ||
      member.split("/").some((part) => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part)))
    fail("unsafe member path")
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function archiveRoster(files) {
  if (!Array.isArray(files) || !files.length) fail("missing archive file roster")
  const entries = new Map()
  for (const file of files) {
    if (file?.domain !== "archive" || !Number.isSafeInteger(file.byteLength) || file.byteLength < 0 || !sha256(file.sha256))
      fail("invalid archive file record")
    requireMemberPath(file.path)
    if (entries.has(file.path)) fail("duplicate archive file record")
    entries.set(file.path, { path: file.path, byteLength: file.byteLength, sha256: file.sha256, executable: false })
  }

  const manifest = files.find((file) => file.path === "distribution.json")
  if (!manifest || !entries.has("checksums.sha256") || !Buffer.isBuffer(manifest.data) ||
      manifest.data.length !== manifest.byteLength || hash(manifest.data) !== manifest.sha256)
    fail("missing or inconsistent embedded distribution companions")
  const descriptor = parseCanonicalJson(manifest.data, "embedded distribution")
  if (!exactKeys(descriptor, ["schema", "version", "target", "files"]) || descriptor.schema !== "orchestra-distribution-v1" ||
      !token(descriptor.version) || !token(descriptor.target) || !Array.isArray(descriptor.files) || !descriptor.files.length ||
      entries.size !== descriptor.files.length + 2)
    fail("invalid embedded distribution descriptor")

  let previous = ""
  for (const row of descriptor.files) {
    if (!exactKeys(row, ["path", "sha256", "executable"]) || !sha256(row.sha256) || typeof row.executable !== "boolean")
      fail("invalid embedded distribution entry")
    requireMemberPath(row.path)
    if (row.path !== "package.json" && !row.path.startsWith("bin/")) fail("invalid distribution payload path")
    const entry = entries.get(row.path)
    if (row.path <= previous || !entry || entry.sha256 !== row.sha256)
      fail("embedded distribution roster differs from archive")
    entry.executable = row.executable
    previous = row.path
  }
  return entries
}

function sameStat(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.nlink === b.nlink &&
    a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs
}

async function verifyFile(filename, before, expected, scratch) {
  if (before.size !== BigInt(expected.byteLength)) fail("installed byte length differs from archive")
  // The producer records whether any execute bit is set, not a full mode.
  const executable = Boolean(before.mode & 0o111n)
  if (executable !== expected.executable) fail("installed executable flag differs from distribution")

  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const pinned = await handle.stat(statOptions)
    if (!sameStat(before, pinned)) fail("file identity changed during verification")
    const digest = createHash("sha256")
    let byteLength = 0
    // Bound reads even if the file grows after the size/identity check.
    while (byteLength <= expected.byteLength) {
      const { bytesRead } = await handle.read(scratch, 0, Math.min(scratch.length, expected.byteLength - byteLength + 1), byteLength)
      if (!bytesRead) break
      byteLength += bytesRead
      digest.update(scratch.subarray(0, bytesRead))
    }
    if (!sameStat(pinned, await handle.stat(statOptions)) || !sameStat(pinned, await lstat(filename, statOptions)))
      fail("file changed during verification")
    if (byteLength !== expected.byteLength) fail("installed byte length differs from archive")
    const sha256 = digest.digest("hex")
    if (sha256 !== expected.sha256) fail("installed hash differs from archive")
    return { path: expected.path, byteLength, sha256, executable }
  } finally {
    await handle.close()
  }
}
