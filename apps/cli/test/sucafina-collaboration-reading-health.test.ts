import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfProductState } from "../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfUiAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import type { BlobTransaction } from "../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { object, type Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Surface } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { observeSfCollaborationReadingHealth } from "../src/sucafina-product/native-ui/collaboration-reading-health.ts"

type Input = Parameters<typeof observeSfCollaborationReadingHealth>[0]
type Operation = Parameters<Input["source"]>[0]
type Source = NonNullable<ReturnType<Input["source"]>>
const operations = [
  "collaboration.relation-read", "collaboration.relation-create", "collaboration.relation-remove",
  "collaboration.thread-read", "collaboration.thread-reply", "collaboration.confirmation-prepare",
  "collaboration.confirmation-project", "collaboration.confirmation-confirm", "collaboration.storage-version",
] as const satisfies readonly Operation[]
const writes = new Set<Operation>(["collaboration.relation-create", "collaboration.relation-remove",
  "collaboration.thread-reply", "collaboration.confirmation-confirm"])
const human: Record<Operation, string> = {
  "collaboration.relation-read": "collaboration.relation.read",
  "collaboration.relation-create": "collaboration.relation.confirm",
  "collaboration.relation-remove": "collaboration.relation.confirm",
  "collaboration.thread-read": "collaboration.thread.read",
  "collaboration.thread-reply": "collaboration.thread.reply",
  "collaboration.confirmation-prepare": "collaboration.confirmation.prepare",
  "collaboration.confirmation-project": "collaboration.confirmation.project",
  "collaboration.confirmation-confirm": "collaboration.confirmation.confirm",
  "collaboration.storage-version": "collaboration.storage.version",
}
const writeActions = new Set([...writes].map((id) => "sf-human:" + human[id]))
const stamp = Object.freeze({
  installationId: "collaboration-health-installation", projectId: "collaboration-health-project", hostId: "collaboration-health-host",
  principalRef: "collaboration-health-person", policyVersion: "collaboration-health-policy", accessRevision: "collaboration-health-access",
})
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

/** Original SQLite storage, C08 reader, source lifecycle and UI leases. No producer response or receipt is installed. */
async function fixture() {
  const controls: { allowed: boolean; canWrite: boolean; revision: string; installed: boolean; calls: number; deniedOperation: string; deniedNamespace: string } = {
    allowed: true, canWrite: true, revision: stamp.accessRevision, installed: true,
    calls: 0, deniedOperation: "", deniedNamespace: "",
  }
  const hooks: { read?: (surface: Surface, snapshot: Snapshot) => Promise<void>; finish?: () => void } = {}
  const directory = await mkdtemp(path.join(tmpdir(), "sf-collaboration-health-"))
  const storage = await openLocalStore(directory)
  cleanups.push(async () => { await storage.dispose(); await rm(directory, { recursive: true, force: true }) })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not read records, write, prepare, dispatch, send, or produce receipts")
  }
  const driver: Parameters<typeof createSfSourcePersistence>[0]["persistence"] = {
    ...storage,
    transaction: (surface, work, options) => storage.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
      await hooks.read?.(surface, snapshot)
      return work(snapshot, blobs)
    }, options),
  }
  const transactionAll = storage.transactionAll
  if (typeof transactionAll !== "function") throw new Error("Original SQLite snapshot transaction required")
  const snapshotDigest = () => transactionAll(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
  let ids = 0
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: () => [], createId: () => "source-" + ++ids })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const controller = new AbortController()
  const request = new Request("https://collaboration-health.example/sucafina/api/ui/context", { signal: controller.signal })
  const identity = () => controls.allowed ? {
    installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
    policyVersion: stamp.policyVersion, accessRevision: controls.revision,
  } : undefined
  const originalUi = createSfUiAuthority({
    authorize: async (original, operation) => original !== request || operation === controls.deniedOperation ||
      !controls.canWrite && writeActions.has(operation) ? undefined : identity(),
    commandIdentity: async () => "command-" + ++ids, createId: () => "lease-" + ++ids,
    now: () => Date.parse("2026-11-22T12:00:00.000Z"),
    privateCommands: operations.map((id) => "sf-human:" + human[id]),
  })
  const admitted: TrustedUiContext[] = [], finished: TrustedUiContext[] = []
  const ui = {
    ...originalUi,
    admit: async (...args: Parameters<typeof originalUi.admit>) => {
      const result = await originalUi.admit(...args)
      if (result.status === "ok") admitted.push(result.value)
      return result
    },
    finish: (context: TrustedUiContext) => {
      finished.push(context); originalUi.finish(context); hooks.finish?.()
    },
  }
  const state = createSfProductState({
    persistence, createId: () => "state-" + ++ids, resolveTarget: async () => ({ incarnation: "health-workspace" }),
    authorize: async (original, _snapshot, namespace) => {
      const actor = original === request && namespace !== controls.deniedNamespace ? identity() : undefined
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-collaboration-health",
    commandDigest: digestSfValue({ purpose: "initialize-collaboration-health" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  // Installation handles remain uninvoked. They are insufficient without every
  // observation from the original UI authority and canonical state reader.
  const sources = new Map<Operation, Source>()
  for (const id of operations) sources.set(id, { producer: never, dependencies: [never, persistence, {}] })
  const installed = Object.freeze({})
  let selected: Operation | undefined
  const input: Input = {
    ui, state, persistence,
    source: (id) => !selected || selected === id ? sources.get(id) : undefined,
    binding: (id, producer) => controls.installed && sources.get(id as Operation)?.producer === producer ? installed : undefined,
  }
  const observe = (operation?: Operation) => {
    selected = operation
    return observeSfCollaborationReadingHealth(input, request, stamp)
  }
  const terminal = () => {
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const lease of admitted) expect(originalUi.requestFor(lease)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { observe, input, sources, controls, hooks, storage, snapshotDigest, admitted, terminal, controller, request }
}

test("collaboration health observes only existing source infrastructure without reading records or changing SQLite", async () => {
  const context = await fixture()
  const before = await context.snapshotDigest()
  expect(await context.observe()).toEqual(operations.map((operationId) => ({
    operationId, state: "ready", reason: null, operational: true,
  })))
  expect(context.admitted).toHaveLength(operations.length)
  expect(await context.snapshotDigest()).toBe(before)
  context.terminal()
})

test("read-only authority retains reads and denies every original mutation action", async () => {
  const context = await fixture()
  context.controls.canWrite = false
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((id) => !writes.has(id)))
  context.terminal()
})

for (const operation of ["collaboration.relation-read", "collaboration.thread-read", "collaboration.confirmation-project"] as const) {
  test(operation + " requires the mounted original binding", async () => {
    const context = await fixture()
    context.controls.installed = false
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })
  test(operation + " preserves exact human-operation denial", async () => {
    const context = await fixture()
    context.controls.deniedOperation = "sf-human:" + human[operation]
    context.hooks.read = async () => { throw new Error("Denied operation must not inspect state") }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })
}
for (const namespace of ["relations", "threads", "confirmations"] as const) {
  test("source health keeps the original " + namespace + " namespace grant", async () => {
    const context = await fixture()
    context.controls.deniedNamespace = namespace
    const observed = (await context.observe()).map((entry) => entry.operationId)
    expect(observed).not.toContain("collaboration.storage-version")
    const relevant = namespace === "relations" ? operations.filter((id) => id.startsWith("collaboration.relation-")) :
      namespace === "threads" ? operations.filter((id) => id.startsWith("collaboration.thread-")) :
      operations.filter((id) => id.startsWith("collaboration.confirmation-"))
    for (const id of relevant) expect(observed).not.toContain(id)
    context.terminal()
  })
}

test("a changed source dependency cannot publish readiness", async () => {
  const context = await fixture()
  context.hooks.read = async () => {
    await Promise.resolve()
    const source = context.sources.get("collaboration.relation-read")!
    context.sources.set("collaboration.relation-read", { ...source, dependencies: [...source.dependencies.slice(0, -1), {}] })
  }
  expect(await context.observe("collaboration.relation-read")).toEqual([])
  context.terminal()
})

test("access revision changed during observation closes the original lease", async () => {
  const context = await fixture()
  context.hooks.read = async () => { await Promise.resolve(); context.controls.revision = "revoked" }
  expect(await context.observe("collaboration.thread-read")).toEqual([])
  context.terminal()
})

test("changing aggregate revision between canonical metadata observations is unavailable", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async (surface, snapshot) => {
    if (surface !== "dashboard") return
    await Promise.resolve()
    const value = object(snapshot.data.__sfProductV1)
    value.revision = Number(value.revision) + ++reads
  }
  expect(await context.observe("collaboration.confirmation-project")).toEqual([])
  context.terminal()
})

test("source exceptions and aborts cannot leave consumed UI leases", async () => {
  const context = await fixture()
  context.hooks.read = async () => { context.controller.abort(); throw new Error("Original source unavailable") }
  expect(await context.observe("collaboration.relation-remove")).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("finish disposal cannot publish an observation captured earlier", async () => {
  const context = await fixture()
  context.hooks.finish = () => { context.controls.installed = false }
  expect(await context.observe("collaboration.confirmation-confirm")).toEqual([])
  context.terminal()
})

test("callable methods cannot replace a canonical state reader", async () => {
  const context = await fixture()
  context.input.state = { ...context.input.state, read: async () => { throw new Error("Unregistered reader") } }
  expect(await context.observe("collaboration.thread-read")).toEqual([])
  expect(context.admitted).toHaveLength(0)
  context.terminal()
})

test("missing original product state remains unavailable without initializing it", async () => {
  const context = await fixture()
  await context.storage.transaction("dashboard", async (snapshot) => {
    delete snapshot.data.__sfProductV1
    return { commit: true, value: undefined }
  })
  const before = await context.snapshotDigest()
  expect(await context.observe("collaboration.confirmation-prepare")).toEqual([])
  expect(await context.snapshotDigest()).toBe(before)
  context.terminal()
})
