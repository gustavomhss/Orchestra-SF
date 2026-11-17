import path from "node:path"
import { constants } from "node:fs"
import { link, lstat, mkdir, open, unlink } from "node:fs/promises"
import type { Stats } from "node:fs"
import { randomUUID } from "node:crypto"
import type { Pointer } from "bun:ffi"

/** Deliberately no Windows mode-bit fallback: Node exposes neither handle DACL verification nor reparse-safe
 * relative opens. Until a real private-file Windows adapter exists this capability is explicitly unavailable.
 */
function platform() {
  if ((process.platform !== "darwin" && process.platform !== "linux") || typeof process.getuid !== "function" ||
    typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_DIRECTORY !== "number")
    throw new Error("SF_NATIVE_PHASE_PRIVATE_FS_UNSUPPORTED_PLATFORM")
  return process.getuid()
}
function same(left: Stats, right: Stats) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.mode === right.mode &&
    left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs
}
function sameDirectory(left: Stats, right: Stats) {
  return left.isDirectory() && right.isDirectory() && left.dev === right.dev && left.ino === right.ino &&
    left.uid === right.uid && left.mode === right.mode
}
function privateFile(info: Stats) {
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== platform() || (info.mode & 0o077) !== 0 ||
    info.nlink !== 1 || info.size < 1 || info.size > 8192) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
}

/** Every ancestor is checked, not just a lexical prefix or mkdir mode. Existing paths are never chmodded/deleted.
 * Root-owned sticky temp ancestors are allowed; the final host directory must be owned by us and mode 0700.
 */
export async function requireSfRoutinePrivateDirectory(directory: string, create = false) {
  const uid = platform()
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
  const parts = directory.slice(path.parse(directory).root.length).split(path.sep).filter(Boolean)
  for (const index of parts.keys()) {
    const current = path.join(path.parse(directory).root, ...parts.slice(0, index + 1))
    const before = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (!before && !create) return false
    if (!before) await mkdir(current, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error
    })
    const found = before ?? await lstat(current)
    const last = index === parts.length - 1
    if (!found.isDirectory() || found.isSymbolicLink() || (found.uid !== uid && found.uid !== 0) ||
      (found.mode & 0o022) !== 0 && !(found.uid === 0 && (found.mode & 0o1000) !== 0 && !last) ||
      last && (found.uid !== uid || (found.mode & 0o077) !== 0)) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
    const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY)
    try {
      if (!sameDirectory(found, await handle.stat())) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
      await noDarwinWriteAcl(handle.fd, last)
      if (!sameDirectory(found, await lstat(current))) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
    } finally { await handle.close() }
  }
  return true
}

export async function readSfRoutinePrivateFile(directory: string, name: string) {
  if (path.basename(name) !== name || name === "." || name === ".." || name.includes("\0")) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
  if (!await requireSfRoutinePrivateDirectory(directory)) return undefined
  const file = path.join(directory, name)
  const parent = await lstat(directory)
  const before = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!before) return undefined
  privateFile(before)
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const opened = await handle.stat()
    privateFile(opened)
    if (!same(before, opened)) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
    await noDarwinWriteAcl(handle.fd, true)
    // Never readFile(): a maliciously oversized input is rejected by stat, and growth is bounded to 8193 bytes.
    const bytes = Buffer.alloc(8193)
    const result = await handle.read(bytes, 0, bytes.length, 0)
    if (result.bytesRead !== opened.size || !same(opened, await handle.stat()) || !same(opened, await lstat(file)) ||
      !sameDirectory(parent, await lstat(directory))) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, result.bytesRead))
  } finally { await handle.close() }
}

export async function publishSfRoutinePrivateFile(directory: string, name: string, text: string) {
  if (path.basename(name) !== name || name === "." || name === ".." || name.includes("\0")) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
  if (Buffer.byteLength(text) > 8192) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_TOO_LARGE")
  await requireSfRoutinePrivateDirectory(directory, true)
  const parent = await lstat(directory)
  const temporary = path.join(directory, `.origin-${randomUUID()}.tmp`)
  const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    await noDarwinWriteAcl(handle.fd, true)
    await handle.writeFile(text)
    await handle.sync()
    const written = await handle.stat()
    privateFile(written)
    if (!same(written, await lstat(temporary)) || parent.dev !== (await lstat(directory)).dev || parent.ino !== (await lstat(directory)).ino)
      throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
    await link(temporary, path.join(directory, name))
  } finally {
    await handle.close()
    await unlink(temporary)
  }
  // Persist directory entry publication as well as file bytes; never replace an existing authoritative name.
  const parentHandle = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY)
  try { await parentHandle.sync() } finally { await parentHandle.close() }
  if (await readSfRoutinePrivateFile(directory, name) !== text) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
}

/** Darwin extended ACLs can grant writes without changing mode bits. Inspect the opened handle, not a pathname.
 * ABI constants/signatures are from the SDK sys/acl.h. Deny every write-capable ALLOW ACE, even to the owner;
 * ordinary inherited deny-delete entries and read/search ALLOW entries are not mistaken for write authority.
 */
async function noDarwinWriteAcl(fd: number, privateTarget = false) {
  if (process.platform !== "darwin") return
  const { dlopen, FFIType, ptr, read } = await import("bun:ffi")
  const library = dlopen("/usr/lib/libSystem.B.dylib", {
    acl_get_fd_np: { args: [FFIType.i32, FFIType.i32], returns: FFIType.ptr },
    acl_get_entry: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    acl_get_tag_type: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    acl_get_permset_mask_np: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
    acl_valid: { args: [FFIType.ptr], returns: FFIType.i32 },
    acl_free: { args: [FFIType.ptr], returns: FFIType.i32 },
    __error: { args: [], returns: FFIType.ptr },
  })
  const acl = library.symbols.acl_get_fd_np(fd, 0x100) as Pointer | null
  try {
    if (!acl) {
      const error = library.symbols.__error()
      if (error && read.i32(error) === 2) return // ENOENT: this descriptor has no extended ACL.
      throw new Error("SF_NATIVE_PHASE_PRIVATE_ACL_UNAVAILABLE")
    }
    if (library.symbols.acl_valid(acl) !== 0) throw new Error("SF_NATIVE_PHASE_PRIVATE_ACL_UNAVAILABLE")
    const entry = new BigUint64Array(1), tag = new Int32Array(1), mask = new BigUint64Array(1)
    for (let ordinal = 0; ordinal <= 169; ordinal++) {
      const result = library.symbols.acl_get_entry(acl, ordinal === 0 ? 0 : -1, ptr(entry))
      const error = result === -1 ? library.symbols.__error() : null
      if (error && read.i32(error) === 22) return // Valid ACL + sequential NEXT at end: Darwin EINVAL (not Linux 0).
      if (result !== 0 || ordinal === 169) throw new Error("SF_NATIVE_PHASE_PRIVATE_ACL_UNAVAILABLE")
      const value = read.ptr(ptr(entry)) as Pointer | null
      if (!value || library.symbols.acl_get_tag_type(value, ptr(tag)) !== 0 ||
        library.symbols.acl_get_permset_mask_np(value, ptr(mask)) !== 0) throw new Error("SF_NATIVE_PHASE_PRIVATE_ACL_UNAVAILABLE")
      // write/add, delete, append/add-subdirectory, delete-child, write-attributes/xattrs/security, change-owner.
      if (tag[0] === 1 && (privateTarget ? (mask[0]! & ~0x100000n) !== 0n : (mask[0]! & 0x3574n) !== 0n))
        throw new Error("SF_NATIVE_PHASE_PRIVATE_ACL_WRITABLE")
    }
  } finally {
    if (acl) library.symbols.acl_free(acl)
    library.close()
  }
}
