export * as ReviewPRStoreV2 from "./review-pr-store"

import { constants } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

/** Only the host-selected cache parent and candidate directory are checked; OS temp ancestors may be aliases. */
export async function directory(store: string, create: boolean) {
  const parent = path.dirname(store)
  if (path.basename(parent) !== "orchestra-review") throw new Error("unexpected analysis store parent")
  for (const location of [parent, store]) {
    if (create) await fs.mkdir(location, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error
    })
    const stat = await fs.lstat(location).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (!stat) return false
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()))
      throw new Error("analysis directory is not private and owned")
  }
  return true
}

/** A checked regular target, never a symlink; the opened descriptor must still name the checked inode. */
export async function open(target: string) {
  const checked = await fs.lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!checked) return undefined
  if (!checked.isFile() || checked.isSymbolicLink() || (checked.mode & 0o022) !== 0 ||
    (typeof process.getuid === "function" && checked.uid !== process.getuid()))
    throw new Error("host facts target is not a private owned regular file")
  const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const actual = await handle.stat()
    if (!actual.isFile() || actual.dev !== checked.dev || actual.ino !== checked.ino ||
      (actual.mode & 0o022) !== 0 || (typeof process.getuid === "function" && actual.uid !== process.getuid()))
      throw new Error("host facts target changed during open")
    return handle
  } catch (error) {
    await handle.close()
    throw error
  }
}
