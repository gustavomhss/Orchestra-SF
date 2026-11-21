import { Database } from "bun:sqlite"
import { lstat, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"

export type CorporateRecoveryPin = Readonly<{
  installationDigest: string
  checkpointDigest: string
  archiveDigest: string
  generation: number
  frontierDigest: string
}>

const digest = /^[0-9a-f]{64}$/

/**
 * The register owner appends generations in DELETE journal mode on the same
 * inode. It must not replace the file or directory. The installation takes a
 * read lock only and never publishes or repairs evidence.
 */
export async function openCorporateRecoveryRegister(file: string, installationDirectory: string, ownerUid = 0) {
  if (!Number.isSafeInteger(ownerUid) || ownerUid < 0 ||
      !isAbsolute(file) || resolve(file) !== file ||
      !isAbsolute(installationDirectory) || resolve(installationDirectory) !== installationDirectory ||
      await realpath(installationDirectory) !== installationDirectory)
    throw new Error("Unsafe corporate recovery register")

  const outside = relative(installationDirectory, file)
  if (!outside.startsWith(`..${sep}`)) throw new Error("Recovery register must be outside installation storage")
  const directory = dirname(file)
  const identity = await registerIdentity(file, directory, ownerUid)

  const requireCurrentFile = async () => {
    const current = await registerIdentity(file, directory, ownerUid)
    if (current.file.dev !== identity.file.dev || current.file.ino !== identity.file.ino ||
        current.directory.dev !== identity.directory.dev || current.directory.ino !== identity.directory.ino ||
        current.ancestors.some((ancestor, index) =>
          ancestor.dev !== identity.ancestors[index]?.dev || ancestor.ino !== identity.ancestors[index]?.ino))
      throw new Error("Corporate recovery register was replaced")
  }
  const connect = async () => {
    await requireCurrentFile()
    const database = new Database(file, { readonly: true, strict: true })
    try {
      database.exec("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=250")
      if (database.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode !== "delete")
        throw new Error("Corporate recovery register requires DELETE journaling")
      await requireCurrentFile()
      return database
    } catch (error) {
      database.close()
      throw error
    }
  }
  const initial = await connect()
  initial.close()

  return Object.freeze({
    async withCurrentPin<T>(installationDigest: string, partitionDigest: string, work: (pin: CorporateRecoveryPin) => Promise<T>): Promise<T | undefined> {
      if (!digest.test(installationDigest) || !digest.test(partitionDigest)) return undefined
      const database = await connect().catch(() => undefined)
      if (!database) return undefined
      try {
        const pin = await acquirePin(database, installationDigest, partitionDigest, requireCurrentFile).catch(() => undefined)
        // Hold the read transaction until the caller has finished, including
        // the commit of its separate store.
        return pin ? await work(pin) : undefined
      } finally {
        try {
          if (database.inTransaction) database.exec("ROLLBACK")
        } finally {
          database.close()
        }
      }
    },
  })
}

async function acquirePin(database: Database, installationDigest: string, partitionDigest: string, requireCurrentFile: () => Promise<void>): Promise<CorporateRecoveryPin | undefined> {
  database.exec("BEGIN")
  const rows = database.query<{ generation: number; checkpointDigest: string; archiveDigest: string; frontierDigest: string }, [string, string]>(`
    SELECT generation, checkpoint_digest AS checkpointDigest, archive_digest AS archiveDigest, frontier_digest AS frontierDigest
    FROM recovery_pins
    WHERE installation_digest = ? AND partition_digest = ?
    ORDER BY generation DESC LIMIT 2
  `).all(installationDigest, partitionDigest)
  const [latest, previous] = rows
  if (!latest || !validGeneration(latest.generation) || typeof latest.checkpointDigest !== "string" ||
      !digest.test(latest.checkpointDigest) || typeof latest.archiveDigest !== "string" ||
      !digest.test(latest.archiveDigest) || typeof latest.frontierDigest !== "string" ||
      !digest.test(latest.frontierDigest) ||
      (previous && (!validGeneration(previous.generation) || previous.generation >= latest.generation)))
    return undefined
  await requireCurrentFile()
  return Object.freeze({ installationDigest, generation: latest.generation, checkpointDigest: latest.checkpointDigest, archiveDigest: latest.archiveDigest, frontierDigest: latest.frontierDigest })
}

function validGeneration(value: number) {
  return Number.isSafeInteger(value) && value > 0
}

async function registerIdentity(file: string, directory: string, ownerUid: number) {
  const hierarchy: string[] = []
  const current = { path: directory }
  while (current.path !== dirname(current.path)) {
    current.path = dirname(current.path)
    hierarchy.push(current.path)
  }
  const [db, parent, resolvedFile, resolvedDirectory, ancestors] = await Promise.all([
    lstat(file, { bigint: true }), lstat(directory, { bigint: true }), realpath(file), realpath(directory),
    Promise.all(hierarchy.map((path) => lstat(path, { bigint: true }))),
  ])
  const uid = BigInt(ownerUid)
  if (!db.isFile() || db.nlink !== 1n || !parent.isDirectory() || db.uid !== uid || parent.uid !== uid ||
      (db.mode & 0o022n) !== 0n || (parent.mode & 0o022n) !== 0n ||
      resolvedFile !== file || resolvedDirectory !== directory)
    throw new Error("Unsafe corporate recovery register")
  if (ancestors.some((ancestor) => {
    if (!ancestor.isDirectory() || (ancestor.uid !== 0n && ancestor.uid !== uid)) return true
    // A root-owned sticky temporary parent prevents users from replacing
    // trusted child directories and permits the isolated hosted CI fixture.
    return (ancestor.mode & 0o022n) !== 0n && (ancestor.uid !== 0n || (ancestor.mode & 0o1000n) === 0n)
  })) throw new Error("Unsafe corporate recovery register ancestor")
  // Refuse any sidecar, including a rollback journal that might be hot.
  await Promise.all(["-journal", "-wal", "-shm"].map(async (suffix) => {
    const exists = await lstat(file + suffix).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined
      throw error
    })
    if (exists) throw new Error("Corporate recovery register has an unsafe journal")
  }))
  return { file: db, directory: parent, ancestors }
}
