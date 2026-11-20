import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { AuthorityGeneration } from "@orchestra/core/session/authority-generation"
import { AuthoritySqlFence } from "@orchestra/core/database/authority-sql-fence"
import { TeamProfileCensus } from "@orchestra/core/database/team-profile-census"
import type { MigrationFiles, Checkpoint } from "./team-profile-core-migration.ts"

const fail = (): never => { throw new Error("SF_CORE_MIGRATION_FILES_UNAVAILABLE") }
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const privateFile = (filename: string, create = false) => {
  const uid = process.geteuid?.()
  if (uid === undefined || !isAbsolute(filename) || resolve(filename) !== filename ||
      realpathSync(dirname(filename)) !== dirname(filename)) return fail()
  const parent = lstatSync(dirname(filename))
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== uid || (parent.mode & 0o022) !== 0) return fail()
  let fd: number
  try { fd = openSync(filename, constants.O_RDWR | constants.O_NOFOLLOW | (create ? constants.O_CREAT | constants.O_EXCL : 0), 0o600) }
  catch (error) {
    if (!create || !error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error
    fd = openSync(filename, constants.O_RDWR | constants.O_NOFOLLOW)
  }
  try {
    const held = fstatSync(fd), named = lstatSync(filename)
    if (!held.isFile() || held.nlink !== 1 || held.uid !== uid || (held.mode & 0o077) !== 0 ||
        !named.isFile() || named.isSymbolicLink() || named.ino !== held.ino || named.dev !== held.dev ||
        realpathSync(filename) !== filename) return fail()
    return { fd, device: held.dev, inode: held.ino }
  } catch (error) { closeSync(fd); throw error }
}
function driver(native: Database): AuthoritySqlFence.Driver {
  return {
    all(query, params = []) {
      const statement = native.prepare(query)
      try { return statement.all(...(params as Parameters<typeof statement.all>)) as AuthoritySqlFence.Row[] }
      finally { statement.finalize() }
    },
    execute(query, params = []) {
      const statement = native.prepare(query)
      try { statement.run(...(params as Parameters<typeof statement.run>)) }
      finally { statement.finalize() }
    },
    inTransaction: () => native.inTransaction,
  }
}

/** Linux/Bun server adapter. Paths come only from the bound Database service, never HTTP. */
export function openTeamProfileMigrationFiles(filename: string, storageId: string): MigrationFiles & { close(): void } {
  if (AuthorityGeneration.filename(filename) !== filename || !/^[a-f0-9]{64}$/.test(storageId)) return fail()
  const held = privateFile(filename)
  let business: Database | undefined, control: Database | undefined
  let controlHeld: ReturnType<typeof privateFile> | undefined
  try {
    business = new Database(filename, { readwrite: true, create: false, strict: true })
    controlHeld = privateFile(filename + ".authority.sqlite", true)
    control = new Database(filename + ".authority.sqlite", { readwrite: true, create: false, strict: true })
    for (const native of [business, control]) {
      native.exec("PRAGMA foreign_keys = ON")
      native.exec("PRAGMA busy_timeout = 5000")
      native.exec("PRAGMA synchronous = FULL")
      if (native.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode !== "wal") return fail()
    }
    const primary = business, current = control, businessDriver = driver(primary)
    if (AuthorityGeneration.storageID(primary, filename) !== storageId) return fail()
    const checkIdentity = () => {
      const currentBusiness = lstatSync(filename), currentControl = lstatSync(filename + ".authority.sqlite")
      if (!currentBusiness.isFile() || currentBusiness.isSymbolicLink() || currentBusiness.dev !== held.device || currentBusiness.ino !== held.inode ||
          !controlHeld || !currentControl.isFile() || currentControl.isSymbolicLink() || currentControl.dev !== controlHeld.device || currentControl.ino !== controlHeld.inode)
        return fail()
    }
    let closed = false
    const checkpointDirectory = filename + ".teams-checkpoints"
    const checkpointPath = (plan: TeamProfileCensus.Plan) => {
      if (closed || plan.storageId !== storageId || !/^[a-f0-9]{64}$/.test(plan.planDigest)) return fail()
      checkIdentity()
      return join(checkpointDirectory, plan.planDigest + ".sqlite")
    }
    const directory = () => {
      try { mkdirSync(checkpointDirectory, { mode: 0o700 }) }
      catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error }
      const stat = lstatSync(checkpointDirectory)
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.geteuid?.() || (stat.mode & 0o077) !== 0 ||
          realpathSync(checkpointDirectory) !== checkpointDirectory) return fail()
    }
    return Object.freeze({
      storageId,
      business: businessDriver,
      control: driver(current),
      checkpoint(plan: TeamProfileCensus.Plan): Checkpoint {
        if (!primary.inTransaction) return fail()
        const source = TeamProfileCensus.inspectInTransaction(businessDriver, storageId)
        if (source.sourceDigest !== plan.sourceDigest) return fail()
        directory()
        const filename = checkpointPath(plan), bytes = primary.serialize()
        if (bytes.length < 100 || bytes.length > 256 * 1024 * 1024 ||
            bytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\0" ||
            bytes[18] !== 2 || bytes[19] !== 2) return fail()
        // sqlite3_deserialize cannot open a WAL-mode image without its WAL. The
        // serialized copy contains the coherent pages; normalize only its format
        // flags before hashing and saving the standalone immutable checkpoint.
        bytes[18] = 1; bytes[19] = 1
        const digest = hash(bytes), file = privateFile(filename, true)
        try {
          const size = fstatSync(file.fd).size
          if (size === 0) {
            writeFileSync(file.fd, bytes)
            fsyncSync(file.fd)
          } else if (size !== bytes.length || hash(readFileSync(file.fd)) !== digest) return fail()
        } finally { closeSync(file.fd) }
        const parent = openSync(checkpointDirectory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
        try { fsyncSync(parent) } finally { closeSync(parent) }
        return Object.freeze({ digest, bytes: bytes.length, sourceDigest: source.sourceDigest })
      },
      verifyCheckpoint(plan: TeamProfileCensus.Plan, checkpoint: Checkpoint) {
        const filename = checkpointPath(plan), file = privateFile(filename)
        try {
          const size = fstatSync(file.fd).size
          if (size !== checkpoint.bytes || size < 1 || size > 256 * 1024 * 1024) return false
          const bytes = readFileSync(file.fd)
          if (hash(bytes) !== checkpoint.digest || checkpoint.sourceDigest !== plan.sourceDigest ||
              bytes.length < 100 || bytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\0" ||
              bytes[18] !== 1 || bytes[19] !== 1) return false
          // Deserialize the actual saved bytes in a disposable database. No saved
          // authority file is opened and no checkpoint replaces a live database.
          const inspection = Database.deserialize(bytes, { readonly: true })
          try {
            inspection.exec("PRAGMA foreign_keys = ON")
            return TeamProfileCensus.inspect(driver(inspection), storageId).sourceDigest === plan.sourceDigest
          } finally { inspection.close(true) }
        } finally { closeSync(file.fd) }
      },
      close() {
        if (closed) return
        closed = true
        try { primary.close(true) } finally { current.close(true) }
      },
    })
  } catch (error) {
    business?.close()
    control?.close()
    throw error
  } finally {
    closeSync(held.fd)
    if (controlHeld) closeSync(controlHeld.fd)
  }
}
