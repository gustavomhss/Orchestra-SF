import { expect, test } from "bun:test"
import { mkdir, rm, symlink } from "node:fs/promises"
import path from "node:path"
import { dependencyFingerprint } from "../../../script/ci-cache-inputs.ts"
import { tmpdir } from "./fixture/tmpdir"

const runtime = { bunVersion: Bun.version, nodeAbi: "137" }
const rootManifest = {
  name: "cache-fixture", packageManager: "bun@" + Bun.version,
  workspaces: { packages: ["packages/*", "nested/worker", "modules/sucafina"] },
  scripts: { postinstall: "bun run --cwd packages/core fix-node-pty", prepare: "husky" },
  patchedDependencies: { "fixture@1": "patches/fixture.patch" },
}
const coreManifest = {
  name: "@fixture/core", scripts: { "fix-node-pty": "bun run script/fix-node-pty.ts" },
  dependencies: { archive: "file:./vendor/local.tgz" },
}
const sources = {
  "package.json": JSON.stringify(rootManifest),
  "bun.lock": "reviewed lock bytes",
  "bunfig.toml": "[install]\nexact = true\n",
  ".npmrc": "registry=https://registry.npmjs.org/\n",
  ".github/actions/setup-bun/action.yml": "reviewed installation recipe",
  "script/ci-cache-inputs.ts": "reviewed fingerprint implementation",
  "packages/core/package.json": JSON.stringify(coreManifest),
  "packages/core/script/fix-node-pty.ts": '#!/usr/bin/env bun\nimport fs from "node:fs/promises"\nvoid fs\n',
  "packages/core/bunfig.toml": "[run]\nshell = 'bun'\n",
  "packages/core/vendor/local.tgz": "local archive bytes",
  "packages/other/package.json": JSON.stringify({ name: "@fixture/other", version: "1" }),
  "nested/worker/package.json": JSON.stringify({ name: "@fixture/worker", version: "1" }),
  "modules/sucafina/package.json": JSON.stringify({
    name: "@fixture/sucafina", dependencies: { xlsx: "./Sucafinav1/vendor/xlsx-0.20.3.tgz" },
  }),
  "modules/sucafina/Sucafinav1/vendor/xlsx-0.20.3.tgz": "bare-relative xlsx archive bytes",
  "patches/fixture.patch": "reviewed patch bytes",
}

test.each(Object.keys(sources))("installed cache fingerprint changes when %s changes", async (file) => {
  await using directory = await fixture()
  const before = await dependencyFingerprint(directory.path, runtime)
  await Bun.write(path.join(directory.path, file), await Bun.file(path.join(directory.path, file)).text() + "\n")
  const after = await dependencyFingerprint(directory.path, runtime)
  expect(after.fingerprint).not.toBe(before.fingerprint)
  expect(after.inputs).toContain(file)
})

test("a leading postinstall shebang is parsed safely and its original bytes still invalidate the cache", async () => {
  await using directory = await fixture()
  const before = await dependencyFingerprint(directory.path, runtime)
  await write(directory.path, "packages/core/script/fix-node-pty.ts",
    sources["packages/core/script/fix-node-pty.ts"].replace("#!/usr/bin/env bun", "#!/usr/bin/bun"))
  expect((await dependencyFingerprint(directory.path, runtime)).fingerprint).not.toBe(before.fingerprint)
})

test("fingerprint is deterministic across roots and creation order", async () => {
  await using first = await fixture()
  await using second = await fixture(true)
  const result = await dependencyFingerprint(first.path, runtime)
  expect(result).toEqual(await dependencyFingerprint(second.path, runtime))
  expect(result.modulesPaths).toEqual([
    "modules/sucafina/node_modules",
    "nested/worker/node_modules",
    "node_modules",
    "packages/core/node_modules",
    "packages/other/node_modules",
  ])
})

test("new admitted workspace is included while docs and installed trees are ignored", async () => {
  await using directory = await fixture()
  const before = await dependencyFingerprint(directory.path, runtime)
  for (const [file, content] of Object.entries({
    "docs/README.md": "unrelated documentation",
    "node_modules/ignored/package.json": "{}",
    "packages/core/node_modules/ignored/package.json": "{}",
    "packages/node_modules/ignored/package.json": "{}",
    "packages/no-manifest/readme.md": "not a workspace",
    "outside/package.json": '{"name":"outside"}',
  })) await write(directory.path, file, content)
  expect(await dependencyFingerprint(directory.path, runtime)).toEqual(before)
  await write(directory.path, "packages/new/package.json", '{"name":"@fixture/new"}')
  const added = await dependencyFingerprint(directory.path, runtime)
  expect(added.fingerprint).not.toBe(before.fingerprint)
  expect(added.inputs).toContain("packages/new/package.json")
  expect(added.modulesPaths).toContain("packages/new/node_modules")
})

test("optional root config removal, installer ABI and production mode invalidate installed trees", async () => {
  await using directory = await fixture()
  const before = await dependencyFingerprint(directory.path, runtime)
  await rm(path.join(directory.path, ".npmrc"))
  expect((await dependencyFingerprint(directory.path, runtime)).fingerprint).not.toBe(before.fingerprint)
  const withoutConfig = await dependencyFingerprint(directory.path, runtime)
  expect((await dependencyFingerprint(directory.path, { ...runtime, nodeAbi: "138" })).fingerprint).not.toBe(withoutConfig.fingerprint)
  expect((await dependencyFingerprint(directory.path, { ...runtime, nodeEnv: "production" })).fingerprint).not.toBe(withoutConfig.fingerprint)
})

test("unadmitted hooks, redirected postinstall and imports are rejected before cache lookup", async () => {
  await using directory = await fixture()
  await write(directory.path, "packages/other/package.json", JSON.stringify({
    name: "@fixture/other", scripts: { postinstall: "bun untracked.ts" },
  }))
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_INSTALL_HOOK_UNADMITTED")
  await write(directory.path, "packages/other/package.json", sources["packages/other/package.json"])
  await write(directory.path, "packages/core/package.json", JSON.stringify({
    ...coreManifest, scripts: { "fix-node-pty": "bun run script/other.ts" },
  }))
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_POSTINSTALL_COMMAND_UNADMITTED")
  await write(directory.path, "packages/core/package.json", sources["packages/core/package.json"])
  await write(directory.path, "packages/core/script/fix-node-pty.ts", '#!/usr/bin/env bun\nimport "./untracked.ts"\n')
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_POSTINSTALL_IMPORT_UNADMITTED")
})

test("unsafe paths, unsupported globs and untracked local dependency directories fail closed", async () => {
  await using directory = await fixture()
  for (const workspace of ["../outside", "node_modules/pkg", "packages/**", "/absolute", "C:/outside"]) {
    await write(directory.path, "package.json", JSON.stringify({
      ...rootManifest, workspaces: { packages: [workspace] },
    }))
    await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_")
  }
  await write(directory.path, "package.json", sources["package.json"])
  for (const dependency of [
    "file:./directory", "./directory", "../directory", "link:./directory",
    "file:../../../../outside.tgz", "../../../../outside.tgz", "/outside.tgz", "C:/outside.tgz", "~/outside.tgz",
  ]) {
    await write(directory.path, "packages/core/package.json", JSON.stringify({
      ...coreManifest, dependencies: { archive: dependency },
    }))
    await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_")
  }
})

test("bare parent-relative archives inside the repository contribute their bytes", async () => {
  await using directory = await fixture()
  await write(directory.path, "packages/shared.tgz", "first archive bytes")
  await write(directory.path, "packages/core/package.json", JSON.stringify({
    ...coreManifest, dependencies: { archive: "../shared.tgz" },
  }))
  const before = await dependencyFingerprint(directory.path, runtime)
  expect(before.inputs).toContain("packages/shared.tgz")
  await write(directory.path, "packages/shared.tgz", "changed archive bytes")
  expect((await dependencyFingerprint(directory.path, runtime)).fingerprint).not.toBe(before.fingerprint)
})

test("cache paths reject controls, whitespace and glob metacharacters in admitted workspace names", async () => {
  await using directory = await fixture()
  for (const workspace of ["nested/with\nnewline", "nested/with\rcarriage", "nested/[glob]", "nested/!glob"]) {
    await write(directory.path, "package.json", JSON.stringify({
      ...rootManifest, workspaces: { packages: [workspace] },
    }))
    await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_")
  }
  await write(directory.path, "package.json", sources["package.json"])
  for (const name of ["bad[glob]", " with-space ", "+(group)"]) {
    await write(directory.path, "packages/" + name + "/package.json", '{"name":"@fixture/unsafe"}')
    await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_WORKSPACE_PATTERN_UNSUPPORTED")
    await rm(path.join(directory.path, "packages", name), { recursive: true })
  }
})

test("source files and workspace symlinks cannot import an outside tree", async () => {
  await using directory = await fixture()
  await using outside = await tmpdir()
  await write(outside.path, "outside.patch", "outside bytes")
  await rm(path.join(directory.path, "patches/fixture.patch"))
  await symlink(path.join(outside.path, "outside.patch"), path.join(directory.path, "patches/fixture.patch"))
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_INPUT_NOT_REGULAR")
  await rm(path.join(directory.path, "patches/fixture.patch"))
  await write(directory.path, "patches/fixture.patch", sources["patches/fixture.patch"])
  await symlink(outside.path, path.join(directory.path, "packages/escape"), "dir")
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow("CACHE_WORKSPACE_SYMLINK")
})

test("missing required inputs and mismatched Bun runtime cannot reuse a cache", async () => {
  await using directory = await fixture()
  await expect(dependencyFingerprint(directory.path, { ...runtime, bunVersion: "0.0.0" })).rejects.toThrow("CACHE_BUN_VERSION_MISMATCH")
  await expect(dependencyFingerprint(directory.path, { ...runtime, nodeAbi: "" })).rejects.toThrow("CACHE_RUNTIME_INVALID")
  await rm(path.join(directory.path, "bun.lock"))
  await expect(dependencyFingerprint(directory.path, runtime)).rejects.toThrow()
})

async function fixture(reverse = false) {
  const directory = await tmpdir()
  const entries = Object.entries(sources)
  for (const [file, content] of reverse ? entries.reverse() : entries) await write(directory.path, file, content)
  return directory
}

async function write(root: string, file: string, content: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true })
  await Bun.write(path.join(root, file), content)
}
