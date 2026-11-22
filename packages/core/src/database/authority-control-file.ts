export * as AuthorityControlFile from "./authority-control-file"

import { closeSync, constants, fstatSync, lstatSync, openSync, statSync } from "node:fs"
import { dirname } from "node:path"
import { AuthorityGeneration } from "../session/authority-generation"

/** The sibling control file is current authority, never part of a business-data restore. */
export function open<A extends { close(): void }>(
  filename: string, connect: (filename: string) => A, options: { create?: boolean } = {},
): A {
  const fail = () => { throw new AuthorityGeneration.GenerationError("unavailable") }
  const parent = statSync(dirname(filename))
  if (!parent.isDirectory() || (parent.mode & 0o022) !== 0) return fail()
  let fd: number
  try {
    fd = options.create === false
      ? openSync(filename, constants.O_RDWR | constants.O_NOFOLLOW)
      : openSync(filename, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600)
  } catch (error) {
    if (options.create === false || !error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error
    fd = openSync(filename, constants.O_RDWR | constants.O_NOFOLLOW)
  }
  let driver: A | undefined
  try {
    const held = fstatSync(fd)
    const uid = process.geteuid?.()
    if (!held.isFile() || held.nlink !== 1 || (held.mode & 0o077) !== 0 || uid === undefined || held.uid !== uid) return fail()
    driver = connect(filename)
    const named = lstatSync(filename)
    if (!named.isFile() || named.isSymbolicLink() || named.dev !== held.dev || named.ino !== held.ino ||
        named.nlink !== 1 || named.uid !== held.uid || (named.mode & 0o077) !== 0) return fail()
    return driver
  } catch (error) {
    driver?.close()
    throw error
  } finally {
    closeSync(fd)
  }
}
