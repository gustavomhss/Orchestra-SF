import path from "node:path"
import { closeSync, constants, fstatSync, fsyncSync, openSync, readSync, writeSync } from "node:fs"
import os from "node:os"
import type { Stats } from "node:fs"
import { randomUUID } from "node:crypto"

/** Deliberately no Windows mode-bit fallback: Node exposes neither handle DACL verification nor reparse-safe
 * relative opens. Until a real private-file Windows adapter exists this capability is explicitly unavailable.
 */
function platform() {
  if ((process.platform !== "darwin" && process.platform !== "linux") || (process.arch !== "arm64" && process.arch !== "x64") || typeof process.getuid !== "function" ||
    typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_DIRECTORY !== "number")
    throw new Error("SF_NATIVE_PHASE_PRIVATE_FS_UNSUPPORTED_PLATFORM")
  return process.getuid()
}
function same(left: Stats, right: Stats) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.mode === right.mode &&
    left.nlink === right.nlink && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs
}
function sameDirectory(left: Stats, right: Stats) {
  return left.isDirectory() && right.isDirectory() && left.dev === right.dev && left.ino === right.ino &&
    left.uid === right.uid && left.mode === right.mode
}
function privateFile(info: Stats, empty = false) {
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== platform() || (info.mode & 0o077) !== 0 ||
    info.nlink !== 1 || info.size < (empty ? 0 : 1) || info.size > 8192) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
}

function basename(name: string) {
  if (!name || path.basename(name) !== name || name === "." || name === ".." || name.includes("\0"))
    throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
  return Buffer.from(`${name}\0`)
}

/** No fd pseudo-paths: libc receives real directory descriptors and single-component names.
 * errno is read immediately on the calling thread. libc/FFI absence is an explicit unsupported capability.
 */
async function posix() {
  platform()
  const { dlopen, FFIType, ptr, read } = await import("bun:ffi").catch(() => {
    throw new Error("SF_NATIVE_PHASE_PRIVATE_FS_PRIMITIVE_UNAVAILABLE")
  })
  const library = (() => {
    try {
      const symbols = {
        // mkdirat's mode_t is u16 on Darwin, u32 on Linux.
        mkdirat: { args: [FFIType.i32, FFIType.ptr, process.platform === "darwin" ? FFIType.u16 : FFIType.u32], returns: FFIType.i32 },
        linkat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
        unlinkat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
      } as const
      return process.platform === "darwin"
        ? dlopen("/usr/lib/libSystem.B.dylib", {
          ...symbols,
          // XNU libsyscall/wrappers/open-base.c: exported fixed-signature syscall entry.
          // Public openat's variadic mode is stack-passed on Apple arm64; a fixed FFI call is NOT equivalent.
          __openat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.u16], returns: FFIType.i32 },
          __error: { args: [], returns: FFIType.ptr },
        })
        : dlopen("libc.so.6", {
          ...symbols,
          openat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
          __errno_location: { args: [], returns: FFIType.ptr },
        })
    } catch {
      throw new Error("SF_NATIVE_PHASE_PRIVATE_FS_PRIMITIVE_UNAVAILABLE")
    }
  })()
  return {
    library,
    ptr,
    openat(fd: number, name: Buffer, flags: number, mode: number) {
      return "__openat" in library.symbols
        ? library.symbols.__openat(fd, ptr(name), flags, mode)
        : library.symbols.openat(fd, ptr(name), flags, mode)
    },
    errno() {
      const pointer = "__error" in library.symbols ? library.symbols.__error() : library.symbols.__errno_location()
      if (!pointer) throw new Error("SF_NATIVE_PHASE_PRIVATE_FS_PRIMITIVE_UNAVAILABLE")
      return read.i32(pointer)
    },
    failure(operation: string, errno: number) {
      return Object.assign(new Error(`SF_NATIVE_PHASE_PRIVATE_FS_${operation}_${errno}`), { errno })
    },
  }
}

/** Owns the complete validated descriptor chain and its libc handle until close(). All subsequent access,
 * publication and cleanup stays relative to that capability, even after any ancestor is renamed/replaced.
 * Existing directories are never chmodded or removed. Root-owned sticky ancestors remain permitted.
 */
export async function openSfRoutinePrivateDirectory(directory: string, create = false) {
  const uid = platform()
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || directory.includes("\0"))
    throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
  const parts = directory.slice(path.parse(directory).root.length).split(path.sep).filter(Boolean)
  if (!parts.length) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
  const native = await posix()
  // SDK sys/fcntl.h (Darwin) / asm-generic/fcntl.h (Linux x64/arm64). Node omits O_CLOEXEC;
  // native openat must set it atomically so concurrent runtime spawns cannot inherit the capability.
  const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW |
    (process.platform === "darwin" ? 0x1000000 : 0x80000)
  const readFlags = (directoryFlags & ~constants.O_DIRECTORY) | constants.O_NONBLOCK
  const descriptors: number[] = []
  const identities: Stats[] = []
  let retained = false
  let closed = false
  let active = false
  function close() {
    if (active) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_BUSY")
    if (closed) return
    closed = true
    try {
      let failure: unknown
      for (const fd of descriptors.toReversed()) {
        try { closeSync(fd) } catch (error) { failure ??= error }
      }
      if (failure) throw failure
    } finally { native.library.close() }
  }
  function begin() {
    if (closed || active) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_UNAVAILABLE")
    active = true
  }
  try {
    descriptors.push(openSync("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW))
    // Include the trusted root descriptor in the same owner/mode/ACL validation as every child.
    for (let index = -1; index < parts.length; index++) {
      if (index >= 0) {
        const component = basename(parts[index]!)
        const parent = descriptors.at(-1)!
        let fd = native.openat(parent, component, directoryFlags, 0)
        if (fd === -1) {
          const errno = native.errno()
          if (errno !== os.constants.errno.ENOENT) throw native.failure("OPEN_DIRECTORY", errno)
          if (!create) return undefined
          if (native.library.symbols.mkdirat(parent, native.ptr(component), 0o700) === -1) {
            const errno = native.errno()
            if (errno !== os.constants.errno.EEXIST) throw native.failure("MKDIR", errno)
          }
          fd = native.openat(parent, component, directoryFlags, 0)
          if (fd === -1) throw native.failure("OPEN_DIRECTORY", native.errno())
        }
        descriptors.push(fd)
      }
      const fd = descriptors.at(-1)!
      const found = fstatSync(fd)
      const last = index === parts.length - 1
      if (!found.isDirectory() || (found.uid !== uid && found.uid !== 0) ||
        (found.mode & 0o022) !== 0 && !(found.uid === 0 && (found.mode & 0o1000) !== 0 && !last) ||
        last && (found.uid !== uid || (found.mode & 0o077) !== 0)) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
      await noDarwinWriteAcl(fd, last)
      if (!sameDirectory(found, fstatSync(fd))) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
      identities.push(found)
    }
    const parent = descriptors.at(-1)!
    const identity = identities.at(-1)!
    async function validate() {
      if (!sameDirectory(identity, fstatSync(parent))) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
      await noDarwinWriteAcl(parent, true)
      if (!sameDirectory(identity, fstatSync(parent))) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_CHANGED")
    }
    async function read(name: string) {
      const leaf = basename(name)
      await validate()
      const fd = native.openat(parent, leaf, readFlags, 0)
      if (fd === -1) {
        const errno = native.errno()
        if (errno === os.constants.errno.ENOENT) return undefined
        throw native.failure("OPEN_FILE", errno)
      }
      try {
        const before = fstatSync(fd)
        privateFile(before)
        await noDarwinWriteAcl(fd, true)
        // Stat/privacy checks precede allocation. Growth is bounded; short reads do not imply EOF.
        const bytes = Buffer.alloc(8193)
        let count = 0
        while (count < bytes.length) {
          const size = readSync(fd, bytes, count, bytes.length - count, count)
          if (!size) break
          count += size
        }
        if (count !== before.size || !same(before, fstatSync(fd))) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
        const check = native.openat(parent, leaf, readFlags, 0)
        if (check === -1) throw native.failure("REOPEN_FILE", native.errno())
        try {
          if (!same(before, fstatSync(check))) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
        } finally { closeSync(check) }
        await validate()
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, count))
      } finally { closeSync(fd) }
    }
    retained = true
    return {
      close,
      async read(name: string) {
        begin()
        try { return await read(name) } finally { active = false }
      },
      async publish(name: string, text: string) {
        begin()
        try {
          const leaf = basename(name)
          if (!Buffer.byteLength(text) || Buffer.byteLength(text) > 8192) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_TOO_LARGE")
          await validate()
          const temporary = basename(`.origin-${randomUUID()}.tmp`)
          const fd = native.openat(parent, temporary,
            (readFlags & ~constants.O_NONBLOCK) | constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)
          if (fd === -1) throw native.failure("CREATE_FILE", native.errno())
          try {
            const fresh = fstatSync(fd)
            privateFile(fresh, true)
            if (fresh.size !== 0) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
            await noDarwinWriteAcl(fd, true)
            if (!same(fresh, fstatSync(fd))) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
            const bytes = Buffer.from(text)
            let count = 0
            while (count < bytes.length) {
              const size = writeSync(fd, bytes, count, bytes.length - count, count)
              if (!size) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_SHORT_WRITE")
              count += size
            }
            fsyncSync(fd)
            const written = fstatSync(fd)
            privateFile(written)
            if (written.size !== bytes.length) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
            await validate()
            const check = native.openat(parent, temporary, readFlags, 0)
            if (check === -1) throw native.failure("REOPEN_TEMPORARY", native.errno())
            try {
              if (!same(written, fstatSync(check))) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
            } finally { closeSync(check) }
            // flags=0 links the entry itself (never follows a source symlink), and never overwrites leaf.
            if (native.library.symbols.linkat(parent, native.ptr(temporary), parent, native.ptr(leaf), 0) === -1)
              throw native.failure("LINK_FILE", native.errno())
          } finally {
            try { closeSync(fd) } finally {
              if (native.library.symbols.unlinkat(parent, native.ptr(temporary), 0) === -1)
                throw native.failure("UNLINK_TEMPORARY", native.errno())
              fsyncSync(parent)
            }
          }
          if (await read(name) !== text) throw new Error("SF_NATIVE_PHASE_PRIVATE_FILE_CHANGED")
        } finally { active = false }
      },
    }
  } finally {
    if (!retained) close()
  }
}

export async function requireSfRoutinePrivateDirectory(directory: string, create = false) {
  const capability = await openSfRoutinePrivateDirectory(directory, create)
  if (!capability) return false
  capability.close()
  return true
}

export async function readSfRoutinePrivateFile(directory: string, name: string) {
  basename(name)
  const capability = await openSfRoutinePrivateDirectory(directory)
  if (!capability) return undefined
  try { return await capability.read(name) } finally { capability.close() }
}

export async function publishSfRoutinePrivateFile(directory: string, name: string, text: string) {
  basename(name)
  const capability = await openSfRoutinePrivateDirectory(directory, true)
  if (!capability) throw new Error("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
  try { await capability.publish(name, text) } finally { capability.close() }
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
  const acl = library.symbols.acl_get_fd_np(fd, 0x100)
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
      const value = read.ptr(ptr(entry))
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
