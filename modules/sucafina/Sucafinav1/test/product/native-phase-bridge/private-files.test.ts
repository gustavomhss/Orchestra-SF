import { expect, test } from "bun:test"
import path from "node:path"
import { chmod, mkdir, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "../../../../../../packages/core/test/fixture/tmpdir.ts"
import { publishSfRoutinePrivateFile, readSfRoutinePrivateFile } from "../../../../../../apps/cli/src/sucafina-product/routine-native-private-files.ts"

const posix = test.skipIf(process.platform === "win32")
posix("private provenance: real positive read, immutable publication, bounded oversized rejection, no symlink/writable path adoption", async () => {
  await using temporary = await tmpdir()
  const directory = path.join(temporary.path, "private")
  await publishSfRoutinePrivateFile(directory, "proof.json", "{\"issued\":true}")
  expect(await readSfRoutinePrivateFile(directory, "proof.json")).toBe("{\"issued\":true}")
  await expect(publishSfRoutinePrivateFile(directory, "proof.json", "{\"replacement\":true}")).rejects.toThrow()
  expect(await readSfRoutinePrivateFile(directory, "proof.json")).toBe("{\"issued\":true}")
  await writeFile(path.join(directory, "oversized.json"), "x".repeat(8193), { mode: 0o600 })
  await expect(readSfRoutinePrivateFile(directory, "oversized.json")).rejects.toThrow("SF_NATIVE_PHASE_PRIVATE_FILE_INVALID")
  await symlink(path.join(directory, "proof.json"), path.join(directory, "alias.json"))
  await expect(readSfRoutinePrivateFile(directory, "alias.json")).rejects.toThrow()
  await symlink(directory, path.join(temporary.path, "directory-alias"))
  await expect(readSfRoutinePrivateFile(path.join(temporary.path, "directory-alias"), "proof.json")).rejects.toThrow()
  const writable = path.join(temporary.path, "existing-writable")
  await mkdir(writable, { mode: 0o700 }); await chmod(writable, 0o777)
  await expect(publishSfRoutinePrivateFile(writable, "must-not-adopt.json", "{}")).rejects.toThrow("SF_NATIVE_PHASE_PRIVATE_DIRECTORY_INVALID")
  // The adapter refuses, rather than repairing/chmodding an existing user's directory.
  expect((await Bun.file(path.join(directory, "proof.json")).text())).toBe("{\"issued\":true}")
})

test.skipIf(process.platform !== "win32")("private provenance: Windows explicitly refuses an unavailable DACL/reparse-safe primitive", async () => {
  await expect(readSfRoutinePrivateFile("C:\\phase-private", "proof.json")).rejects.toThrow("SF_NATIVE_PHASE_PRIVATE_FS_UNSUPPORTED_PLATFORM")
})
