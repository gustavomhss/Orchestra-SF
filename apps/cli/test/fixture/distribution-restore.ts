import { createHash } from "node:crypto"
import { copyFile, readdir, readFile, rename } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

// The documented restore: move the live database and its sidecars aside, then
// copy the migration backup onto the database path. The caller starts the same
// CLI afterwards. This does not open the owner's database.
export async function restoreIsolatedDatabase(file: string) {
  const backup = await onlyBackup(file)
  const bytes = await readFile(backup)
  const hash = createHash("sha256").update(bytes).digest("hex")
  await moveAside(file)
  await moveAside(`${file}-wal`)
  await moveAside(`${file}-shm`)
  await copyFile(backup, file)
  if (createHash("sha256").update(await readFile(file)).digest("hex") !== hash)
    throw new Error("ISOLATED_DB_RESTORE_BYTES")
  await absent(`${file}-wal`)
  await absent(`${file}-shm`)
}

async function onlyBackup(file: string) {
  const base = basename(file)
  const names = (await readdir(dirname(file))).filter((name) => name.startsWith(`${base}.backup-`)).sort()
  if (names.length !== 1) throw new Error(`ISOLATED_DB_BACKUP_COUNT: ${names.length}`)
  const name = names[0]!
  const rest = name.slice(`${base}.backup-`.length)
  const split = rest.lastIndexOf("-")
  const from = rest.slice(0, split)
  const time = rest.slice(split + 1)
  if (split <= 0 || !/^[A-Za-z0-9_-]+$/.test(from) || !/^\d+$/.test(time))
    throw new Error("ISOLATED_DB_BACKUP_NAME")
  return join(dirname(file), name)
}

async function moveAside(path: string) {
  await rename(path, `${path}.aside`).catch((error: unknown) => {
    if (missing(error)) return
    throw error
  })
}

async function absent(path: string) {
  await readFile(path).then(
    () => {
      throw new Error("ISOLATED_DB_RESTORE_SIDECAR")
    },
    (error: unknown) => {
      if (missing(error)) return
      throw error
    },
  )
}

function missing(error: unknown) {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT"
}
