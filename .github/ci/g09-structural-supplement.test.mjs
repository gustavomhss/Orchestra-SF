import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { exactExport, exportLeaves, registryURL, safeRelative, sha256, verifiedMembers, verifyFinding, verifyGitBytes, verifySRI } from "./g09-structural-supplement.mjs"

assert.equal(process.env.GITHUB_ACTIONS, "true", "Controls are authorized only in Actions")

test("registry acquisition rejects a foreign host, credentials, redirect-shaped URL and encoded traversal", () => {
  assert.equal(registryURL("https://registry.npmjs.org/vitest/-/vitest-4.1.12.tgz"), "https://registry.npmjs.org/vitest/-/vitest-4.1.12.tgz")
  for (const value of ["https://registry.npmjs.org.evil.example/a.tgz", "http://registry.npmjs.org/a.tgz",
    "https://secret@registry.npmjs.org/a.tgz", "https://registry.npmjs.org/a.tgz?redirect=x", "https://registry.npmjs.org/%2foutside.tgz"])
    assert.throws(() => registryURL(value))
})
test("SRI rejects changed bytes and unsupported integrity formats", () => {
  const bytes = Buffer.from("frozen tar bytes")
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64")
  verifySRI(bytes, integrity)
  assert.throws(() => verifySRI(Buffer.from("changed tar bytes"), integrity))
  assert.throws(() => verifySRI(bytes, "sha256-" + sha256(bytes)))
})
test("a changed manifest or target cannot inherit the Git and diagnostic file bindings", () => {
  const bytes = Buffer.from('{"imports":{"#sqlite":"./sqlite.bun.ts"}}')
  const oid = createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex")
  verifyGitBytes(bytes, oid, sha256(bytes))
  assert.throws(() => verifyGitBytes(Buffer.from('{"imports":{"#sqlite":"./unrelated.ts"}}'), oid, sha256(bytes)))
  assert.throws(() => verifyGitBytes(bytes, oid, "0".repeat(64)))
})
test("exact subpaths do not fall back to root exports or invent a wildcard resolution", () => {
  const pkg = { exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } }
  assert.equal(exactExport(pkg, "./brand"), null)
  assert.equal(exactExport({ exports: { "./*": "./src/*.js" } }, "./brand"), null)
  assert.deepEqual(exactExport(pkg, ".").map((row) => row.conditions), [["types"], ["default"]])
  assert.throws(() => exportLeaves({ default: "../outside.js" }))
  assert.throws(() => exportLeaves(["./fallback.js"]))
})
test("member verification fails when any declared conditional target is absent", () => {
  const leaves = exportLeaves({ import: "./index.js", require: "./index.cjs" })
  const members = new Map([["package/index.js", { path: "package/index.js", sha256: "a".repeat(64), byteLength: 1 }]])
  assert.throws(() => verifiedMembers(leaves, members), /exported target missing/)
  members.set("package/index.cjs", { path: "package/index.cjs", sha256: "b".repeat(64), byteLength: 2 })
  assert.equal(verifiedMembers(leaves, members).length, 2)
  assert.throws(() => verifiedMembers(null, members))
})
test("path contract rejects parent traversal, absolute paths, empty segments and backslashes", () => {
  for (const value of ["../escape", "/absolute", "a/../b", "a//b", "a\\b", "C:/escape", "a/./b"])
    assert.throws(() => safeRelative(value))
  assert.equal(safeRelative("package/dist/index.js"), "package/dist/index.js")
})
test("per-ID binding rejects a changed importer, specifier or semantic disposition", () => {
  const body = { domain: "source", from: "modules/atlas/example.ts", fileSha256: "a".repeat(64),
    start: 0, end: 20, kind: "static-import-or-reexport", specifier: "vitest", targets: [], status: "unresolved" }
  const edge = { id: sha256(JSON.stringify(body)), ...body }
  const gap = { kind: "unresolved-import-or-content-edge", domain: "source", path: body.from, fileSha256: body.fileSha256, edge }
  const item = { id: sha256(JSON.stringify(gap)), ...gap, disposition: null }
  verifyFinding(item)
  assert.throws(() => verifyFinding({ ...item, path: "modules/atlas/other.ts" }))
  assert.throws(() => verifyFinding({ ...item, edge: { ...edge, specifier: "fast-check" } }))
  assert.throws(() => verifyFinding({ ...item, disposition: { classification: "technical-placement" } }))
})
