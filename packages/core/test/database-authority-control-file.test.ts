import { expect, test } from "bun:test"
import { chmod, link, lstat, readFile, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { AuthorityControlFile } from "../src/database/authority-control-file"
import { AuthorityControl } from "../src/database/authority-control"
import { openAuthorityControl } from "../src/database/sqlite.bun"
import { tmpdir } from "./fixture/tmpdir"

test("a newly created private control file has stable identity on reopen", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "authority.sqlite")
  const first = AuthorityControlFile.open(filename, openAuthorityControl)
  const id = AuthorityControl.open(first).controlId
  first.close()
  expect((await lstat(filename)).mode & 0o077).toBe(0)
  const second = AuthorityControlFile.open(filename, openAuthorityControl)
  try { expect(AuthorityControl.open(second).controlId).toBe(id) } finally { second.close() }
})

test("a symlink control path is refused without modifying the target", async () => {
  await using directory = await tmpdir()
  const target = path.join(directory.path, "target")
  const filename = path.join(directory.path, "authority.sqlite")
  await writeFile(target, "PRIVATE-CONTROL-TARGET", { mode: 0o600 })
  await symlink(target, filename)
  let opened = false
  expect(() => AuthorityControlFile.open(filename, () => { opened = true; return { close() {} } })).toThrow()
  expect(opened).toBe(false)
  expect(await readFile(target, "utf8")).toBe("PRIVATE-CONTROL-TARGET")
})

test("hardlinked and broadly readable control files are refused before SQLite opens them", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "authority.sqlite")
  await writeFile(filename, "UNCHANGED", { mode: 0o600 })
  await link(filename, path.join(directory.path, "alias"))
  let opened = false
  expect(() => AuthorityControlFile.open(filename, () => { opened = true; return { close() {} } })).toThrow("unavailable")
  expect(opened).toBe(false)
  const exposed = path.join(directory.path, "exposed.sqlite")
  await writeFile(exposed, "UNCHANGED", { mode: 0o600 })
  await chmod(exposed, 0o644)
  expect(() => AuthorityControlFile.open(exposed, () => { opened = true; return { close() {} } })).toThrow("unavailable")
  expect(opened).toBe(false)
  expect((await lstat(exposed)).mode & 0o777).toBe(0o644)
})
