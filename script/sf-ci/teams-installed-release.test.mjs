import assert from "node:assert/strict"
import { chmod, link, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { hash, record } from "./team-profile-residue.mjs"
import { verifyTeamsInstalledRelease, verifyTeamsRunningExecutable } from "./teams-installed-release.mjs"

const cli = "bin/orchestra"
const web = "bin/web/index.html"
const manifestPath = "distribution.json"
const checksumsPath = "checksums.sha256"
const binaryLength = 90_123
const json = (value) => JSON.stringify(value, null, 2) + "\n"

async function fixture(t, { reverse = false, editManifest } = {}) {
  const temporary = await realpath(await mkdtemp(path.join(tmpdir(), "teams-installed-release-")))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const releaseRoot = path.join(temporary, "release")
  const at = (member) => path.join(releaseRoot, member)
  await mkdir(releaseRoot, { mode: 0o755 })

  // Use the archive reader's record format. Provenance qualification is
  // intentionally outside this fixture and remains a caller precondition.
  const payload = [record("archive", cli, Buffer.alloc(binaryLength, 0xff)), record("archive", web, "<html></html>\n"),
    record("archive", "package.json", '{"version":"1.0.0"}\n')]
  const descriptor = { schema: "orchestra-distribution-v1", version: "1.0.0", target: "linux-x64-baseline",
    files: payload.map((file) => ({ path: file.path, sha256: file.sha256, executable: file.path === cli })) }
  editManifest?.(descriptor)
  const manifest = record("archive", manifestPath, json(descriptor))
  const checksums = record("archive", checksumsPath, [...payload.slice(0, 2), manifest, payload[2]]
    .map((file) => `${file.sha256}  ${file.path}\n`).join(""))
  const files = [payload[0], payload[1], checksums, manifest, payload[2]] // Canonical roster order.
  for (const file of reverse ? [...files].reverse() : files) {
    const location = at(file.path)
    await mkdir(path.dirname(location), { recursive: true, mode: 0o755 })
    await writeFile(location, file.data)
    await chmod(location, file.path === cli ? 0o555 : 0o444)
  }
  return { releaseRoot, temporary, at, files: reverse ? [...files].reverse() : files }
}

test("reports only the canonical closure digest, independent of root and creation/record order", async (t) => {
  const first = await fixture(t)
  const second = await fixture(t, { reverse: true })
  const [binary, index, checksums, manifest, metadata] = first.files
  const roster = [
    { path: cli, byteLength: binaryLength, sha256: binary.sha256, executable: true },
    { path: web, byteLength: 14, sha256: index.sha256, executable: false },
    { path: checksumsPath, byteLength: checksums.byteLength, sha256: checksums.sha256, executable: false },
    { path: manifestPath, byteLength: manifest.byteLength, sha256: manifest.sha256, executable: false },
    { path: "package.json", byteLength: metadata.byteLength, sha256: metadata.sha256, executable: false },
  ]
  const expected = {
    proofClass: "INSTALLED_RELEASE_BYTES_MATCH_ARCHIVE_ONLY",
    installedClosureSha256: hash(JSON.stringify(roster)),
  }
  assert.deepEqual(await verifyTeamsInstalledRelease(first), expected)
  assert.deepEqual(await verifyTeamsInstalledRelease(second), expected)
})

test("a verified release tree cannot substitute for its executable running on Linux", async (t) => {
  const input = await fixture(t)
  assert.equal((await verifyTeamsInstalledRelease(input)).proofClass, "INSTALLED_RELEASE_BYTES_MATCH_ARCHIVE_ONLY")
  await assert.rejects(verifyTeamsRunningExecutable({ ...input, pid: 0 }), /Linux service PID required/)
  await assert.rejects(verifyTeamsRunningExecutable({ ...input, pid: process.pid }), process.platform === "linux"
    ? /running executable is not the release binary/
    : /Linux service PID required/)
})

async function replaceCli({ at }, bytes) {
  await chmod(at(cli), 0o755)
  await writeFile(at(cli), Buffer.from(bytes))
  await chmod(at(cli), 0o555)
}

const defects = [
  ["a missing file", ({ at }) => rm(at(web)), /missing file in release/],
  ["a sidecar not in the archive", ({ at }) => writeFile(at(".a7-source.json"), "{}"), /unlisted file/],
  ["an extra empty directory", ({ at }) => mkdir(at("bin/empty"), { mode: 0o755 }), /unlisted directory/],
  ["a truncated file", (input) => replaceCli(input, [0]), /byte length differs/],
  ["same-length tampering", (input) => {
    const bytes = Buffer.from(input.files.find((file) => file.path === cli).data)
    bytes[bytes.length - 1] ^= 1
    return replaceCli(input, bytes)
  }, /hash differs/],
  ["a removed executable flag", ({ at }) => chmod(at(cli), 0o444), /executable flag differs/],
  ["an added executable flag on a companion", ({ at }) => chmod(at(checksumsPath), 0o555), /executable flag differs/],
  ["a group-writable directory", ({ at }) => chmod(at("bin"), 0o775), /unsafe directory storage/],
  ["special mode bits on a regular file", ({ at }) => chmod(at(cli), 0o4555), /unsafe file storage/],
  ["an unsafe member name", ({ at }) => writeFile(at("bin/unsafe:name"), "extra"), /unsafe member path/],
  ["a file symlink to matching bytes", async ({ at, temporary }) => {
    const outside = path.join(temporary, "outside")
    await writeFile(outside, "<html></html>\n")
    await rm(at(web))
    await symlink(outside, at(web))
  }, /symbolic link/],
  ["a directory symlink", async ({ at, temporary }) => {
    await rm(at("bin/web"), { recursive: true })
    await symlink(temporary, at("bin/web"))
  }, /symbolic link/],
  ["a regular file linked outside the release", ({ at, temporary }) =>
    link(at(cli), path.join(temporary, "other-link")), /multiply linked file/],
]

for (const [title, mutate, refusal] of defects) {
  test(`refuses ${title}`, async (t) => {
    const input = await fixture(t)
    await mutate(input)
    await assert.rejects(verifyTeamsInstalledRelease(input), refusal)
  })
}

test("refuses a noncanonical root and redacts filesystem errors", async (t) => {
  const input = await fixture(t)
  const alias = path.join(input.temporary, "alias")
  await symlink(input.releaseRoot, alias)
  await assert.rejects(verifyTeamsInstalledRelease({ ...input, releaseRoot: alias }), /release root is not canonical/)
  await assert.rejects(verifyTeamsInstalledRelease({ ...input, releaseRoot: path.join(input.temporary, "absent") }), {
    message: "TEAMS_INSTALLED_RELEASE_FAIL_CLOSED: could not read release or embedded distribution",
  })
})

test("refuses manifest fields absent from the producer format", async (t) => {
  const input = await fixture(t, { editManifest: (manifest) => { manifest.files[0].byteLength = binaryLength } })
  await assert.rejects(verifyTeamsInstalledRelease(input), /invalid embedded distribution entry/)
})

test("refuses a manifest hash that disagrees with the archive record", async (t) => {
  const input = await fixture(t, { editManifest: (manifest) => { manifest.files[0].sha256 = "0".repeat(64) } })
  await assert.rejects(verifyTeamsInstalledRelease(input), /embedded distribution roster differs from archive/)
})

test("refuses a duplicated manifest row masking an omitted payload file", async (t) => {
  const input = await fixture(t, { editManifest: (manifest) => { manifest.files[1] = manifest.files[0] } })
  await assert.rejects(verifyTeamsInstalledRelease(input), /embedded distribution roster differs from archive/)
})

test("refuses a path traversal in a manifest entry", async (t) => {
  const input = await fixture(t, { editManifest: (manifest) => { manifest.files[0].path = "bin/../orchestra" } })
  await assert.rejects(verifyTeamsInstalledRelease(input), /unsafe member path/)
})
