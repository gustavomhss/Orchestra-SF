import { expect, test } from "bun:test"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfProductState } from "../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfUiAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import type { AssetPersistence, BlobTransaction } from "../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { object, type Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Surface } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { empty, testPersistence } from "../../../modules/sucafina/Sucafinav1/test/fixture/persistence.ts"
import { observeSfAnalysisReadingHealth } from "../src/sucafina-product/native-ui/analysis-reading-health.ts"

type Input = Parameters<typeof observeSfAnalysisReadingHealth>[0]
type Operation = Parameters<Input["source"]>[0]
type Source = NonNullable<ReturnType<Input["source"]>>
const catalog = "intelligence.analysis.choices", history = "intelligence.analysis.list"
const stamp = Object.freeze({
  installationId: "analysis-health-installation", projectId: "analysis-health-project", hostId: "analysis-health-host",
  principalRef: "analysis-health-person", policyVersion: "analysis-health-policy", accessRevision: "analysis-health-access",
})

/** Original UI leases, C08 reader and source lifecycle; only external revocation is controlled. */
async function fixture() {
  const controls: { allowed: boolean; revision: string; installed: boolean; calls: number; deniedOperation: string; deniedNamespace: string } = {
    allowed: true, revision: stamp.accessRevision, installed: true, calls: 0, deniedOperation: "", deniedNamespace: "",
  }
  const hooks: { read?: (surface: Surface, snapshot: Snapshot) => Promise<void>; finish?: () => void } = {}
  const memory = testPersistence({ dashboard: empty(), planner: empty(), procurement: empty() })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not invoke catalog, list, models, prepare, dispatch, receipts or blobs")
  }
  const blobs: BlobTransaction = { get: never, put: never, remove: never }
  const driver: AssetPersistence = {
    transaction: (surface, work, options) => memory.persistence.transaction(surface, async (snapshot) => {
      await hooks.read?.(surface, snapshot)
      return work(snapshot, blobs)
    }, options),
  }
  let ids = 0
  const identity = () => controls.allowed ? {
    installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
    policyVersion: stamp.policyVersion, accessRevision: controls.revision,
  } : undefined
  const originalUi = createSfUiAuthority({
    authorize: async (_request, operation) => operation === controls.deniedOperation ? undefined : identity(),
    commandIdentity: async () => "command-" + ++ids, createId: () => "lease-" + ++ids,
    now: () => Date.parse("2026-11-21T12:00:00.000Z"),
    privateCommands: ["sf-human:analysis.prepare", "sf-human:analysis.read"],
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
      finished.push(context)
      originalUi.finish(context)
      hooks.finish?.()
    },
  }
  const persistence = createSfSourcePersistence({
    persistence: driver, enumerate: () => [], createId: () => "source-" + ++ids,
  })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const controller = new AbortController()
  const request = new Request("https://analysis-health.example/sucafina/api/ui/context", { signal: controller.signal })
  const state = createSfProductState({
    persistence, createId: () => "state-" + ++ids, resolveTarget: async () => ({ incarnation: "health-workspace" }),
    authorize: async (_request, _snapshot, namespace) => {
      const actor = namespace === controls.deniedNamespace ? undefined : identity()
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-analysis-health",
    commandDigest: digestSfValue({ purpose: "initialize-analysis-health" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  // Installed route functions are never called by health. Only original authority and C08 observations can yield readiness.
  const sources: Record<Operation, Source | undefined> = {
    [catalog]: { producer: never, dependencies: [never, persistence] },
    [history]: { producer: never, dependencies: [never, persistence] },
  }
  const installed = Object.freeze({})
  let selected: Operation | undefined
  const input: Input = {
    ui, state, persistence, source: (id) => !selected || selected === id ? sources[id] : undefined,
    binding: (id, producer) => controls.installed && (id === catalog || id === history) && sources[id]?.producer === producer
      ? installed : undefined,
  }
  const observe = (operation?: Operation) => {
    selected = operation
    return observeSfAnalysisReadingHealth(input, request, stamp)
  }
  const terminal = () => {
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const lease of admitted) expect(originalUi.requestFor(lease)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { observe, controls, hooks, sources, memory, admitted, finished, terminal, request, controller, input, persistence }
}

test("analysis health observes two mounted reads without querying cases, models or outputs", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  expect(await context.observe()).toEqual([
    { operationId: catalog, state: "ready", reason: null, operational: true },
    { operationId: history, state: "ready", reason: null, operational: true },
  ])
  expect(context.admitted.length).toBe(2)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

for (const operation of [catalog, history] as const) {
  test(operation + " requires the original mounted binding", async () => {
    const context = await fixture()
    context.controls.installed = false
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  test(operation + " preserves original operation denial", async () => {
    const context = await fixture()
    context.controls.deniedOperation = operation === catalog ? "sf-human:analysis.prepare" : "sf-human:analysis.read"
    context.hooks.read = async () => { throw new Error("Denied operation must not read metadata") }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  test(operation + " requires every original namespace grant", async () => {
    const context = await fixture()
    context.controls.deniedNamespace = operation === catalog ? "cases" : "contributions"
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })

  test(operation + " rejects an installed dependency replaced during a read", async () => {
    const context = await fixture()
    context.hooks.read = async () => {
      await Promise.resolve()
      const source = context.sources[operation]!
      context.sources[operation] = { ...source, dependencies: [...source.dependencies.slice(0, -1), {}] }
    }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })

  test(operation + " rejects access revocation during a read", async () => {
    const context = await fixture()
    context.hooks.read = async () => { await Promise.resolve(); context.controls.revision = "revoked" }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })

  test(operation + " rejects revisions that change between metadata observations", async () => {
    const context = await fixture()
    let reads = 0
    context.hooks.read = async (surface, snapshot) => {
      if (surface !== "dashboard") return
      await Promise.resolve()
      const state = object(snapshot.data.__sfProductV1)
      state.revision = Number(state.revision) + ++reads
    }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })

  test(operation + " finishes its original lease after a source error", async () => {
    const context = await fixture()
    context.hooks.read = async () => { throw new Error("Original state unavailable") }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })

  test(operation + " does not publish readiness after finish disposes its binding", async () => {
    const context = await fixture()
    context.hooks.finish = () => { context.controls.installed = false }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(1)
    context.terminal()
  })
}

test("analysis history health requires original C08 state rather than callable availability", async () => {
  const context = await fixture()
  delete context.memory.state.dashboard.data.__sfProductV1
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("analysis catalog health rejects an aborted request after admission and finishes its lease", async () => {
  const context = await fixture()
  context.hooks.read = async () => { await Promise.resolve(); context.controller.abort() }
  expect(await context.observe(catalog)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})
