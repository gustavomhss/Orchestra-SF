import { expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { restoreIsolatedDatabase } from "./fixture/distribution-restore"

test("isolated restore keeps the backup bytes and drops wal sidecars", async () => {
  const dir = await mkdtemp(join(tmpdir(), "isolated-restore-"))
  const file = join(dir, "proof.sqlite")
  await writeFile(file, "live-migrated")
  await writeFile(`${file}-wal`, "wal")
  await writeFile(`${file}-shm`, "shm")
  await writeFile(`${file}.backup-legacy-20`, "pre-migration")

  await restoreIsolatedDatabase(file)

  expect(await readFile(file, "utf8")).toBe("pre-migration")
  expect(await readFile(`${file}.aside`, "utf8")).toBe("live-migrated")
  expect(await readFile(`${file}-wal.aside`, "utf8")).toBe("wal")
  await expect(readFile(`${file}-wal`)).rejects.toThrow()
  await expect(readFile(`${file}-shm`)).rejects.toThrow()
})

test("isolated restore accepts a hyphenated migration id", async () => {
  const dir = await mkdtemp(join(tmpdir(), "isolated-restore-"))
  const file = join(dir, "proof.sqlite")
  await writeFile(file, "live")
  await writeFile(`${file}.backup-20261105202635_inbox-location-20`, "pre")

  await restoreIsolatedDatabase(file)

  expect(await readFile(file, "utf8")).toBe("pre")
})

test("isolated restore refuses a missing, extra, or unnamed backup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "isolated-restore-"))
  const file = join(dir, "proof.sqlite")
  await writeFile(file, "live")
  await expect(restoreIsolatedDatabase(file)).rejects.toThrow("ISOLATED_DB_BACKUP_COUNT: 0")

  await writeFile(`${file}.backup-legacy-1`, "a")
  await writeFile(`${file}.backup-legacy-2`, "b")
  await expect(restoreIsolatedDatabase(file)).rejects.toThrow("ISOLATED_DB_BACKUP_COUNT: 2")

  const other = await mkdtemp(join(tmpdir(), "isolated-restore-"))
  const named = join(other, "proof.sqlite")
  await writeFile(named, "live")
  await writeFile(`${named}.backup-has space-3`, "x")
  await expect(restoreIsolatedDatabase(named)).rejects.toThrow("ISOLATED_DB_BACKUP_NAME")
})
