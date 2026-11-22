import { expect, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, realpath, rename, rm, symlink } from "node:fs/promises"
import path from "node:path"
import { tmpdir, userInfo } from "node:os"
import { createSfHostRuntime } from "../src/sucafina-product/host-context"
import { createLocalInstallation } from "../../../modules/sucafina/Sucafinav1/local/entry"
import { loadLocalConfiguration, prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration"

// Observe the directory passed by the real entry, then delegate to the real host factory.
const installationId = "d1e1902b-33e9-46b2-aaf2-6e8c88a3f621"
const origin = "http://127.0.0.1:4110"

async function fixture() {
  const container = await mkdtemp(path.join(await realpath(tmpdir()), "sf-phase-workspace-"))
  const root = path.join(container, "installation")
  const configuration = await prepareLocalConfiguration(root, origin)
  const loaded = await loadLocalConfiguration(configuration)
  await Bun.write(configuration, JSON.stringify({ ...loaded.config, authentication: "local-operator",
    localOperator: { installationId, uid: userInfo().uid, name: "Phase fixture operator" } }))
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"), XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
  }
  const directories: string[] = []
  return { container, root, configuration, environment, directories, keys: loaded.keys,
    open: (file = configuration) => createLocalInstallation({ origin, createHostRuntime: async (input) => {
      directories.push(input.directory)
      return createSfHostRuntime(input)
    } }, file, environment) }
}


test("Local Operator uses one private workspace for the real host factory", async () => {
  const installed = await fixture()
  try {
    const workspace = path.join(installed.root, "workspace")
    const before = await (async () => {
      const installation = await installed.open()
      try {
        expect(installed.directories).toEqual([workspace])
        expect(await realpath(workspace)).toBe(workspace)
        const metadata = await lstat(workspace)
        expect(metadata.isDirectory()).toBe(true)
        expect(metadata.mode & 0o077).toBe(0)
        expect(metadata.uid).toBe(userInfo().uid)
        const database = await lstat(path.join(installed.root, "business-local", "installation.sqlite"))
        expect(database.isFile()).toBe(true)
        const loaded = await loadLocalConfiguration(installed.configuration)
        expect(loaded.directory).toBe(installed.root)
        expect(loaded.keys).toEqual(installed.keys)
        return { workspace: metadata, database }
      } finally { await installation.dispose() }
    })()
    const reopened = await installed.open()
    try {
      expect(installed.directories).toEqual([workspace, workspace])
      const after = await lstat(workspace)
      expect({ dev: after.dev, ino: after.ino, mode: after.mode }).toEqual({
        dev: before.workspace.dev, ino: before.workspace.ino, mode: before.workspace.mode,
      })
      const database = await lstat(path.join(installed.root, "business-local", "installation.sqlite"))
      expect({ dev: database.dev, ino: database.ino }).toEqual({ dev: before.database.dev, ino: before.database.ino })
      expect((await loadLocalConfiguration(installed.configuration)).keys).toEqual(installed.keys)
    } finally { await reopened.dispose() }
  } finally { await rm(installed.container, { recursive: true, force: true }) }
}, 120_000)

test("Local Operator refuses unsafe or aliased workspace before creating host runtime", async () => {
  const installed = await fixture()
  const workspace = path.join(installed.root, "workspace")
  try {
    await mkdir(workspace, { mode: 0o700 })
    const denied = async (file = installed.configuration) => {
      const calls = installed.directories.length
      await expect(installed.open(file).then(async (installation) => { await installation.dispose(); return installation })).rejects.toThrow()
      expect(installed.directories.length).toBe(calls)
    }
    await chmod(workspace, 0o755)
    try {
      await denied()
      expect((await lstat(workspace)).mode & 0o777).toBe(0o755)
      expect(await Bun.file(path.join(installed.root, "business-local", "installation.sqlite")).exists()).toBe(false)
    } finally { await chmod(workspace, 0o700) }
    const retained = path.join(installed.root, "retained-workspace")
    await rename(workspace, retained)
    try {
      await symlink(retained, workspace, "dir")
      try { await denied(); expect((await lstat(workspace)).isSymbolicLink()).toBe(true) }
      finally { await rm(workspace) }
      await Bun.write(workspace, "not a directory")
      try { await denied(); expect(await Bun.file(workspace).text()).toBe("not a directory") }
      finally { await rm(workspace) }
    } finally { await rename(retained, workspace) }
    await chmod(installed.container, 0o777)
    try { await denied() } finally { await chmod(installed.container, 0o700) }
    await denied(installed.root + "/./installation.json")
    await denied(path.relative(process.cwd(), installed.configuration))
    const link = path.join(installed.container, "installation-link")
    await symlink(installed.root, link, "dir")
    try { await denied(path.join(link, "installation.json")) } finally { await rm(link) }
    expect((await loadLocalConfiguration(installed.configuration)).keys).toEqual(installed.keys)
  } finally { await rm(installed.container, { recursive: true, force: true }) }
}, 120_000)

