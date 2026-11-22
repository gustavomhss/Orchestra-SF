import { expect, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, realpath, rename, rm, symlink } from "node:fs/promises"
import path from "node:path"
import { tmpdir, userInfo } from "node:os"
import { AgentV2 } from "@orchestra/core/agent"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { Snapshot } from "@orchestra/core/snapshot"
import { Effect, Exit } from "effect"
import { createSfHostRuntime } from "../src/sucafina-product/host-context"
import { createLocalInstallation } from "../../../modules/sucafina/Sucafinav1/local/entry"
import { loadLocalConfiguration, prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration"
import { createSfUiAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/ui-authority"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
import { createSfRoutineNativeGovernance } from "../src/sucafina-product/routine-native-governance"
import { createSfRoutineNativeRuntime, type SfRoutineNativeRuntimeIdentity, type SfRoutineNativeRuntimeResources } from "../src/sucafina-product/routine-native-runtime"
import { createSfRoutinePhaseOrigin, readSfRoutinePhaseParent } from "../src/sucafina-product/routine-native-phase-origin"
import { createSfRoutinePhaseFence } from "../src/sucafina-product/routine-native-phase-fence"
import { sfNativeLocationRef } from "../src/sucafina-product/native-identity"

// Real entry, host factory, configured Global factory and Phase/Session graph.
// SQLite uses the test preload's private database; authentication is a fixture input to the real UI lease registry.
// This is a component factory proof, not installed Teams qualification.
const installationId = "d1e1902b-33e9-46b2-aaf2-6e8c88a3f621"
const origin = "http://127.0.0.1:4110"
const request = new Request(origin + "/sucafina/routines/catalog", { method: "POST" })
const scope = { caseRef: { id: "physical-case", incarnation: "physical-incarnation", version: 1 },
  job: "plan only", providerGeneration: 1, policyVersion: "policy-1", accessRevision: "access-1", originKind: "ui" as const }
const nextID = () => SessionSchema.ID.make("ses_sfphase_" + crypto.randomUUID().replaceAll("-", ""))

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

async function withRuntime<A>(root: string, directory: string, consume: (resources: SfRoutineNativeRuntimeResources) => Promise<A>) {
  const state: { identity?: SfRoutineNativeRuntimeIdentity } = {}
  const governance = createSfRoutineNativeGovernance({ records: () => runtime.resources()?.records })
  const runtime = createSfRoutineNativeRuntime({ installationId, identity: () => state.identity, governance })
  const data = path.join(root, "host-data", "orchestra")
  const cache = path.join(root, "host-cache", "orchestra")
  const globals = { home: root, data, cache, config: path.join(root, "host-config"), state: path.join(root, "host-state", "orchestra"),
    tmp: path.join(root, "host-tmp", "orchestra"), bin: path.join(cache, "bin"), log: path.join(data, "log"), repos: path.join(data, "repos") }
  for (const directory of Object.values(globals)) await mkdir(directory, { recursive: true, mode: 0o700 })
  const graph = AppNodeBuilder.build(LayerNode.group([
    Database.node, EventV2.node, Global.node, ProjectV2.node, SessionStore.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node,
  ]), [[Global.node, Global.layerWith(globals)],
    [SessionExecution.node, SessionExecutionLocal.node], [Snapshot.node, Snapshot.noopLayer],
    ...(governance.contribution.replacements ?? [])], runtime.contribution.locationNodes)
  try {
    return await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const projects = yield* ProjectV2.Service
      const locations = yield* LocationServiceMap.Service
      const global = yield* Global.Service
      const project = yield* projects.resolve(AbsolutePath.make(directory))
      state.identity = Object.freeze({ installationId, hostId: crypto.randomUUID(),
        projectId: project.id, location: sfNativeLocationRef({ directory: AbsolutePath.make(directory) }) })
      yield* locations.contextEffect(state.identity.location)
      const resources = runtime.resources()
      if (!resources?.sessions || !resources.current()) return yield* Effect.die("Real runtime capture unavailable")
      expect(resources.identity).toBe(state.identity)
      expect(resources.originDirectory).toBe(path.join(global.data, "sucafina", "native-origins"))
      expect(global.data).toBe(path.join(root, "host-data", "orchestra"))
      expect(path.isAbsolute(resources.originDirectory!)).toBe(true)
      return yield* Effect.promise(() => consume(resources))
    }).pipe(Effect.provide(graph))))
  } finally { runtime.dispose(); governance.dispose() }
}

async function admit(resources: SfRoutineNativeRuntimeResources, active: () => boolean = () => true) {
  const authority = createSfUiAuthority({
    authorize: async () => active() ? { installationId: resources.identity.installationId, projectId: resources.identity.projectId,
      principalRef: `macos:${installationId}:${userInfo().uid}`, policyVersion: scope.policyVersion, accessRevision: scope.accessRevision } : undefined,
    commandIdentity: async () => "phase-original-ui-command", createId: () => crypto.randomUUID(), now: Date.now,
    privateCommands: ["sf-human:routines.run"],
  })
  const digest = digestSfValue(scope)
  const admitted = await authority.admit(request, "sf-human:routines.run", digest)
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") throw new Error("Original UI admission unavailable")
  expect(await authority.validate(admitted.value, "sf-human:routines.run", digest)).toBe(true)
  return { call: admitted.value, current: () => authority.revalidate(admitted.value) }
}

test("Local Operator uses one private workspace for the real Phase origin", async () => {
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
        await withRuntime(installed.root, installed.directories[0]!, async (resources) => {
          const admission = await admit(resources)
          const origin = createSfRoutinePhaseOrigin(() => resources.originDirectory)
          const fence = createSfRoutinePhaseFence({ resources: () => resources, originDirectory: () => resources.originDirectory })
          const id = nextID()
          const proof = await Effect.runPromise(origin.create(resources, resources.sessions!, admission.call, request, scope, id, admission.current))
          const parent = await Effect.runPromise(resources.store.get(id))
          expect(parent?.agent).toBe(AgentV2.defaultID)
          expect(await realpath(resources.originDirectory!)).toBe(resources.originDirectory!)
          expect(await origin.read(resources, admission.call, scope)).toEqual(proof)
          expect(await origin.readSession(resources, admission.call, id)).toEqual(proof)
          expect(await readSfRoutinePhaseParent(resources.originDirectory!, parent!)).toBe(true)
          await Effect.runPromise(fence.enter(id, { signal: new AbortController().signal,
            current: admission.current, ready: () => true }, fence.beforeTurn(parent!)))
        })
        expect((await lstat(path.join(installed.root, "business-local", "installation.sqlite"))).isFile()).toBe(true)
        expect((await lstat(installed.environment.ORCHESTRA_DB)).isFile()).toBe(true)
        const loaded = await loadLocalConfiguration(installed.configuration)
        expect(loaded.directory).toBe(installed.root)
        expect(loaded.keys).toEqual(installed.keys)
        return metadata
      } finally { await installation.dispose() }
    })()
    const reopened = await installed.open()
    try {
      expect(installed.directories).toEqual([workspace, workspace])
      const after = await lstat(workspace)
      expect({ dev: after.dev, ino: after.ino, mode: after.mode }).toEqual({ dev: before.dev, ino: before.ino, mode: before.mode })
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

test("Phase refuses incompatible private origins and revoked original UI authority", async () => {
  const installed = await fixture()
  try {
    const installation = await installed.open()
    try {
      expect(installed.directories).toEqual([path.join(installed.root, "workspace")])
      await withRuntime(installed.root, installed.directories[0]!, async (resources) => {
        const current = { directory: resources.originDirectory!, authorized: true }
        const admission = await admit(resources, () => current.authorized)
        const origin = createSfRoutinePhaseOrigin(() => current.directory)
        const fence = createSfRoutinePhaseFence({ resources: () => resources, originDirectory: () => current.directory })
        const id = nextID()
        const proof = await Effect.runPromise(origin.create(resources, resources.sessions!, admission.call, request, scope, id, admission.current))
        const parent = await Effect.runPromise(resources.store.get(id))
        const turn = () => Effect.runPromise(fence.enter(id, { signal: new AbortController().signal,
          current: admission.current, ready: () => true }, fence.beforeTurn(parent!)))
        await turn()
        const physical = current.directory
        const link = path.join(installed.root, "origin-link")
        const ancestor = path.join(installed.root, "data-link")
        await symlink(physical, link, "dir")
        await symlink(path.join(installed.root, "host-data"), ancestor, "dir")
        try {
          for (const incompatible of [
            path.join(installed.directories[0]!, "private-origin"),
            path.relative(process.cwd(), physical), physical + "/../native-origins", link,
            path.join(ancestor, "orchestra", "sucafina", "native-origins"),
          ]) {
            current.directory = incompatible
            await expect(origin.readSession(resources, admission.call, id)).rejects.toThrow()
            await expect(turn()).rejects.toThrow()
            const refusedID = nextID()
            expect(Exit.isFailure(await Effect.runPromiseExit(origin.reserve(resources, resources.sessions!, admission.call, refusedID, admission.current)))).toBe(true)
            expect(await Effect.runPromise(resources.store.get(refusedID))).toBeUndefined()
          }
        } finally { current.directory = physical; await rm(link); await rm(ancestor) }
        const parentDirectory = path.dirname(physical)
        await chmod(parentDirectory, 0o777)
        try {
          await expect(origin.readSession(resources, admission.call, id)).rejects.toThrow()
          await expect(turn()).rejects.toThrow()
          const refusedID = nextID()
          expect(Exit.isFailure(await Effect.runPromiseExit(origin.reserve(resources, resources.sessions!, admission.call, refusedID, admission.current)))).toBe(true)
          expect(await Effect.runPromise(resources.store.get(refusedID))).toBeUndefined()
        } finally { await chmod(parentDirectory, 0o700) }
        expect(await origin.readSession(resources, admission.call, id)).toEqual(proof)
        current.authorized = false
        await expect(turn()).rejects.toThrow()
        const revokedID = nextID()
        expect(Exit.isFailure(await Effect.runPromiseExit(origin.reserve(resources, resources.sessions!, admission.call, revokedID, admission.current)))).toBe(true)
        expect(await Effect.runPromise(resources.store.get(revokedID))).toBeUndefined()
        current.authorized = true
        expect(await admission.current()).toBe(false)
      })
    } finally { await installation.dispose() }
  } finally { await rm(installed.container, { recursive: true, force: true }) }
}, 120_000)
