import assert from "node:assert/strict"
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { hash, record } from "./team-profile-residue.mjs"
import { verifyTeamsInstalledRelease } from "./teams-installed-release.mjs"
import { stageVerifiedTeamsRelease } from "./teams-stage-release.mjs"

const cli = "bin/orchestra"
const web = "bin/web/index.html"
const manifestPath = "distribution.json"
const checksumsPath = "checksums.sha256"
const json = (value) => JSON.stringify(value, null, 2) + "\n"

async function fixture(t, { webPath = web, editManifest } = {}) {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "teams-stage-release-")))
  t.after(() => rm(parent, { recursive: true, force: true }))
  await chmod(parent, 0o700)

  // Use readTarArchive records, without claiming artifact provenance.
  const payload = [record("archive", cli, Buffer.alloc(90_123, 0xff)),
    record("archive", webPath, "<html></html>\n"), record("archive", "package.json", '{"version":"1.0.0"}\n')]
  const descriptor = { schema: "orchestra-distribution-v1", version: "1.0.0", target: "linux-x64-baseline",
    files: payload.map((file) => ({ path: file.path, sha256: file.sha256, executable: file.path === cli })) }
  editManifest?.(descriptor)
  const manifest = record("archive", manifestPath, json(descriptor))
  const checksums = record("archive", checksumsPath, [payload[0], payload[1], manifest, payload[2]]
    .map((file) => `${file.sha256}  ${file.path}\n`).join(""))
  return { parent, destination: path.join(parent, "release"), files: [payload[0], payload[1], checksums, manifest, payload[2]] }
}

test("stages every archive member at its exact bytes and returns the installed closure", async (t) => {
  const { parent, destination, files } = await fixture(t)
  const proof = await stageVerifiedTeamsRelease({ destination, files })
  const expected = { proofClass: "INSTALLED_RELEASE_BYTES_MATCH_ARCHIVE_ONLY",
    installedClosureSha256: hash(JSON.stringify(files.map(({ path, byteLength, sha256 }) =>
      ({ path, byteLength, sha256, executable: path === cli })))) }
  assert.deepEqual(proof, expected)
  assert.deepEqual(await verifyTeamsInstalledRelease({ releaseRoot: destination, files }), expected)
  assert.deepEqual(await readdir(parent), ["release"])
  for (const directory of [destination, path.join(destination, "bin"), path.join(destination, "bin/web")])
    assert.equal((await lstat(directory)).mode & 0o7777, 0o700)
  for (const file of files) {
    const filename = path.join(destination, file.path)
    assert.deepEqual(await readFile(filename), file.data)
    assert.equal((await lstat(filename)).mode & 0o7777, file.path === cli ? 0o700 : 0o600)
  }
  await assert.rejects(stageVerifiedTeamsRelease({ destination, files }), /destination already exists/)
  assert.deepEqual(await verifyTeamsInstalledRelease({ releaseRoot: destination, files }), expected)
})

test("refuses existing directories, files and dangling symlinks without altering them", async (t) => {
  const { parent, destination, files } = await fixture(t)
  const existingFile = path.join(parent, "existing-file")
  const alias = path.join(parent, "existing-link")
  const absent = path.join(parent, "absent")
  await mkdir(destination)
  await writeFile(existingFile, "keep")
  await symlink(absent, alias)
  for (const occupied of [destination, existingFile, alias])
    await assert.rejects(stageVerifiedTeamsRelease({ destination: occupied, files }), /destination already exists/)
  assert.deepEqual(await readdir(destination), [])
  assert.equal(await readFile(existingFile, "utf8"), "keep")
  assert.equal(await readlink(alias), absent)
  await assert.rejects(lstat(absent), { code: "ENOENT" })
})

test("refuses noncanonical destinations and missing, public or symlinked parents", async (t) => {
  const { parent, files } = await fixture(t)
  const publicParent = path.join(parent, "public")
  const privateParent = path.join(parent, "private")
  const alias = path.join(parent, "alias")
  await mkdir(publicParent)
  await chmod(publicParent, 0o755)
  await mkdir(privateParent)
  await chmod(privateParent, 0o700)
  await symlink(parent, alias, "dir")
  for (const destination of ["relative-release", `${parent}/./release`, `${parent}//release`, `${parent}/release/`])
    await assert.rejects(stageVerifiedTeamsRelease({ destination, files }), /absolute normalized path/)
  for (const destination of [path.join(parent, "missing/release"), path.join(publicParent, "release"),
    path.join(alias, "release"), path.join(alias, "private/release")])
    await assert.rejects(stageVerifiedTeamsRelease({ destination, files }), /existing canonical owner-only directory/)
  assert.deepEqual((await readdir(parent)).sort(), ["alias", "private", "public"])
  assert.deepEqual(await readdir(publicParent), [])
  assert.deepEqual(await readdir(privateParent), [])
})

test("refuses arbitrary member paths, duplicate records, and file-directory overlaps", async (t) => {
  const { parent, destination, files } = await fixture(t)
  for (const member of ["/outside", "bin/../outside", "bin//extra", "bin/extra:name"])
    await assert.rejects(stageVerifiedTeamsRelease({ destination, files: [{ ...files[0], path: member }, ...files.slice(1)] }),
      /unsafe archive member path/)
  for (const [member, refusal] of [[cli, /duplicate archive file record/], ["bin/web", /overlaps a directory/],
    ["bin/Web/other.html", /differ only by case/]])
    await assert.rejects(stageVerifiedTeamsRelease({ destination, files: [...files, record("archive", member, "extra")] }), refusal)
  assert.deepEqual(await readdir(parent), [])
})

test("refuses wrong archive data type, length and hash even for non-manifest records", async (t) => {
  const { parent, destination, files } = await fixture(t)
  const companion = files.find((file) => file.path === checksumsPath)
  const rest = files.filter((file) => file !== companion)
  const changed = Buffer.from(companion.data)
  changed[0] ^= 1
  for (const [data, refusal] of [[companion.data.toString("utf8"), /invalid archive file record/],
    [companion.data.subarray(1), /length differs/], [changed, /hash differs/]])
    await assert.rejects(stageVerifiedTeamsRelease({ destination, files: [...rest, { ...companion, data }] }), refusal)
  assert.deepEqual(await readdir(parent), [])
})

test("refuses invalid executable flags and inconsistent embedded roster multiplicity", async (t) => {
  for (const [editManifest, refusal] of [
    [(manifest) => { manifest.files[0].executable = 1 }, /invalid embedded distribution entry/],
    [(manifest) => { manifest.files[0].sha256 = "0".repeat(64) }, /embedded distribution roster differs/],
    [(manifest) => { manifest.files[1] = manifest.files[0] }, /embedded distribution roster differs/],
    [(manifest) => { manifest.files.pop() }, /invalid embedded distribution descriptor/],
  ]) {
    const input = await fixture(t, { editManifest })
    await assert.rejects(stageVerifiedTeamsRelease(input), refusal)
    assert.deepEqual(await readdir(input.parent), [])
  }
})

test("rolls back only the new tree if local storage refuses a member after creation", async (t) => {
  // Lexically valid member, longer than NAME_MAX on Linux and macOS local filesystems.
  const input = await fixture(t, { webPath: `bin/web/${"x".repeat(1024)}.html` })
  await writeFile(path.join(input.parent, "sentinel"), "unchanged")
  await assert.rejects(stageVerifiedTeamsRelease(input), /could not stage and verify release/)
  assert.deepEqual(await readdir(input.parent), ["sentinel"])
  assert.equal(await readFile(path.join(input.parent, "sentinel"), "utf8"), "unchanged")
})
