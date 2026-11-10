import { Database } from "bun:sqlite"
import { afterAll, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync } from "fs"
import { rm } from "fs/promises"
import os from "os"
import path from "path"
import { CredentialCipher } from "@orchestra/core/credential/cipher"

const root = mkdtempSync(path.join(os.tmpdir(), "orchestra-refuse-key-"))
afterAll(() => rm(root, { recursive: true, force: true }))

function dir(name: string) {
  const made = path.join(root, name)
  mkdirSync(made)
  return made
}

test("a database with no credential table is not sealed data", async () => {
  const data = dir("fresh")
  const db = new Database(path.join(data, "orchestra.db"))
  db.exec("CREATE TABLE migration (id TEXT)")
  db.close()
  await CredentialCipher.refuseNewKey(path.join(data, "credential.key"))
})

test("a credential table that cannot be read does not look empty", async () => {
  const data = dir("wrong-shape")
  const db = new Database(path.join(data, "orchestra.db"))
  db.exec("CREATE TABLE credential (id TEXT)")
  db.close()
  await expect(CredentialCipher.refuseNewKey(path.join(data, "credential.key"))).rejects.toThrow(/no such column/i)
})
