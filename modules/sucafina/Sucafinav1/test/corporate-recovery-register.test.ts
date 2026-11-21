import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { openCorporateRecoveryRegister } from "../runtime/corporate-recovery-register.ts"

const installation = "a".repeat(64)
const partition = "b".repeat(64)
const checkpoint = "c".repeat(64)
const frontier = "d".repeat(64)
const archive = "e".repeat(64)

test("corporate register pins its generation until the asynchronous restore and commit complete", async () => {
  await withRegisterFixture(async ({ file, installationDirectory, ownerUid, writer }) => {
    const insert = writer.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)")
    insert.run(installation, partition, 1, checkpoint, archive, frontier)
    const register = await openCorporateRecoveryRegister(file, installationDirectory, ownerUid)
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const held = register.withCurrentPin(installation, partition, async (pin) => {
      entered.resolve()
      await release.promise
      return pin.generation
    })
    try {
      expect(await Promise.race([entered.promise.then(() => true), held.then(() => false)])).toBe(true)
      writer.exec("BEGIN IMMEDIATE")
      insert.run(installation, partition, 2, checkpoint, archive, frontier)
      expect(() => writer.exec("COMMIT")).toThrow(/database is locked/i)
    } finally {
      release.resolve()
      await held
    }
    expect(await held).toBe(1)
    writer.exec("COMMIT")
    expect(await register.withCurrentPin(installation, partition, async (pin) => pin.generation)).toBe(2)
  })
})

test("corporate register selects the latest generation only for the requested installation and partition", async () => {
  await withRegisterFixture(async ({ file, installationDirectory, ownerUid, writer }) => {
    const insert = writer.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)")
    insert.run(installation, partition, 1, "f".repeat(64), archive, "0".repeat(64))
    insert.run(installation, partition, 5, checkpoint, archive, frontier)
    insert.run(installation, "0".repeat(64), 70, checkpoint, archive, frontier)
    insert.run("1".repeat(64), partition, 72, checkpoint, archive, frontier)
    const register = await openCorporateRecoveryRegister(file, installationDirectory, ownerUid)
    expect(await register.withCurrentPin(installation, partition, async (pin) => pin)).toEqual({
      installationDigest: installation,
      checkpointDigest: checkpoint,
      archiveDigest: archive,
      generation: 5,
      frontierDigest: frontier,
    })
    expect(await register.withCurrentPin(installation, "2".repeat(64), async () => {
      throw new Error("A missing pin cannot authorize restore")
    })).toBeUndefined()
  })
})

test("corporate register refuses a missing file, malformed latest pin, and potentially hot journal", async () => {
  await withRegisterFixture(async ({ directory, file, installationDirectory, ownerUid, writer }) => {
    await expect(openCorporateRecoveryRegister(join(directory, "missing.sqlite"), installationDirectory, ownerUid)).rejects.toThrow()
    const insert = writer.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)")
    insert.run(installation, partition, 1, checkpoint, archive, frontier)
    insert.run(installation, partition, 2, checkpoint, "malformed", frontier)
    const register = await openCorporateRecoveryRegister(file, installationDirectory, ownerUid)
    const mustNotRun = async () => {
      throw new Error("Unavailable evidence cannot authorize restore")
    }
    expect(await register.withCurrentPin(installation, partition, mustNotRun)).toBeUndefined()
    await Bun.write(file + "-journal", "potentially hot journal")
    await expect(openCorporateRecoveryRegister(file, installationDirectory, ownerUid)).rejects.toThrow(/unsafe journal/i)
    expect(await register.withCurrentPin(installation, partition, mustNotRun)).toBeUndefined()
  })
})

test("corporate register refuses a group-writable ancestor even when its immediate directory remains private", async () => {
  await withRegisterFixture(async ({ directory, file, installationDirectory, ownerUid, writer }) => {
    writer.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)").run(installation, partition, 1, checkpoint, archive, frontier)
    const register = await openCorporateRecoveryRegister(file, installationDirectory, ownerUid)
    const ancestor = dirname(directory)
    try {
      await chmod(ancestor, 0o770)
      await expect(openCorporateRecoveryRegister(file, installationDirectory, ownerUid)).rejects.toThrow(/unsafe.*ancestor/i)
      expect(await register.withCurrentPin(installation, partition, async () => {
        throw new Error("Untrusted register directory cannot authorize restore")
      })).toBeUndefined()
    } finally {
      await chmod(ancestor, 0o700)
    }
  })
})

async function withRegisterFixture(work: (fixture: {
  directory: string
  file: string
  installationDirectory: string
  ownerUid: number
  writer: Database
}) => Promise<void>) {
  const ownerUid = process.getuid?.()
  if (ownerUid === undefined) throw new Error("Corporate registry tests require Unix file ownership")
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-corporate-recovery-register-"))
  try {
    const directory = join(root, "external")
    const installationDirectory = join(root, "installation")
    await Promise.all([mkdir(directory, { mode: 0o700 }), mkdir(installationDirectory, { mode: 0o700 })])
    const file = join(directory, "control.sqlite")
    const writer = new Database(file, { create: true, strict: true })
    try {
      writer.exec(`
        PRAGMA journal_mode=DELETE;
        PRAGMA busy_timeout=0;
        CREATE TABLE recovery_pins (
          installation_digest TEXT NOT NULL, partition_digest TEXT NOT NULL,
          generation INTEGER NOT NULL, checkpoint_digest TEXT NOT NULL,
          archive_digest TEXT NOT NULL, frontier_digest TEXT NOT NULL,
          PRIMARY KEY (installation_digest, partition_digest, generation)
        ) STRICT;
      `)
      await work({ directory, file, installationDirectory, ownerUid, writer })
    } finally {
      writer.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
