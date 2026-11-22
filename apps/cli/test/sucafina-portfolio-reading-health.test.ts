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
import { observeSfPortfolioReadingHealth } from "../src/sucafina-product/native-ui/portfolio-reading-health.ts"

type Input = Parameters<typeof observeSfPortfolioReadingHealth>[0]
type Operation = Parameters<Input["source"]>[0]
type Source = NonNullable<ReturnType<Input["source"]>>
const history = "portfolio.decision-portfolio-results", evaluation = "portfolio.decision-portfolio-evaluate", sensitivity = "portfolio.decision-sensitivity-evaluate"
const operations = [history, "portfolio.decision-portfolio-read", "portfolio.decision-portfolio-preview", evaluation,
  "portfolio.decision-sensitivity-units", "portfolio.decision-sensitivity-read", sensitivity] as const
const human = (id: Operation) => id === evaluation ? "sf-human:decisions.portfolio.evaluate" :
  id === sensitivity ? "sf-human:decisions.sensitivity.evaluate" : "sf-human:decisions.portfolio.read"
const stamp = Object.freeze({
  installationId: "portfolio-health-installation", projectId: "portfolio-health-project", hostId: "portfolio-health-host",
  principalRef: "portfolio-health-person", policyVersion: "portfolio-health-policy", accessRevision: "portfolio-health-access",
})

/** Original UI leases, C08 reader and source lifecycle; only external revocation is controlled. */
async function fixture() {
  const controls: { allowed: boolean; revision: string; installed: boolean; calls: number; deniedOperation: string; deniedNamespace: string; canWrite: boolean } = {
    allowed: true, revision: stamp.accessRevision, installed: true, calls: 0, deniedOperation: "", deniedNamespace: "", canWrite: true,
  }
  const hooks: { read?: (surface: Surface, snapshot: Snapshot) => Promise<void>; finish?: () => void } = {}
  const memory = testPersistence({ dashboard: empty(), planner: empty(), procurement: empty() })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not invoke scenario, preview, evaluation, persistence, dispatch, receipts or blobs")
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
    privateCommands: ["sf-human:decisions.portfolio.read", "sf-human:decisions.portfolio.evaluate", "sf-human:decisions.sensitivity.evaluate"],
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
  const request = new Request("https://portfolio-health.example/sucafina/api/ui/context", { signal: controller.signal })
  const state = createSfProductState({
    persistence, createId: () => "state-" + ++ids, resolveTarget: async () => ({ incarnation: "health-workspace" }),
    authorize: async (_request, _snapshot, namespace, mode) => {
      const actor = namespace === controls.deniedNamespace || mode === "write" && !controls.canWrite ? undefined : identity()
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-portfolio-health",
    commandDigest: digestSfValue({ purpose: "initialize-portfolio-health" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  // Installed route functions are never called by health. Only original authority and C08 observations can yield readiness.
  const sources: Record<Operation, Source | undefined> = {
    "portfolio.decision-portfolio-results": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-portfolio-read": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-portfolio-preview": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-portfolio-evaluate": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-sensitivity-units": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-sensitivity-read": { producer: never, dependencies: [never, persistence] },
    "portfolio.decision-sensitivity-evaluate": { producer: never, dependencies: [never, persistence] },
  }
  const installed = Object.freeze({})
  let selected: Operation | undefined
  const input: Input = {
    ui, state, persistence, source: (id) => !selected || selected === id ? sources[id] : undefined,
    binding: (id, producer) => controls.installed && operations.some((operation) => operation === id) && sources[id]?.producer === producer
      ? installed : undefined,
  }
  const observe = (operation?: Operation) => {
    selected = operation
    return observeSfPortfolioReadingHealth(input, request, stamp)
  }
  const terminal = () => {
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const lease of admitted) expect(originalUi.requestFor(lease)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { observe, controls, hooks, sources, memory, admitted, finished, terminal, request, controller, input, persistence }
}

test("portfolio health observes the seven installed boundaries without producing a result or write", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  expect(await context.observe()).toEqual(operations.map((operationId) => ({
    operationId, state: "ready", reason: null, operational: true,
  })))
  expect(context.admitted).toHaveLength(7)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

test("read-only namespace access keeps reads available without admitting persisted evaluations", async () => {
  const context = await fixture()
  context.controls.canWrite = false
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(
    operations.filter((operation) => operation !== evaluation && operation !== sensitivity),
  )
  context.terminal()
})

for (const operation of [history, evaluation, sensitivity] as const) {
  test(operation + " requires the original mounted binding", async () => {
    const context = await fixture()
    context.controls.installed = false
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  test(operation + " preserves the exact original human action denial", async () => {
    const context = await fixture()
    context.controls.deniedOperation = human(operation)
    context.hooks.read = async () => { throw new Error("Denied operation must not read metadata") }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  for (const namespace of ["cases", "preferences"] as const) {
    test(operation + " requires original " + namespace + " namespace access", async () => {
      const context = await fixture()
      context.controls.deniedNamespace = namespace
      expect(await context.observe(operation)).toEqual([])
      expect(context.admitted).toHaveLength(1)
      context.terminal()
    })
  }
}

test("portfolio health rejects an original source dependency replaced during its metadata read", async () => {
  const context = await fixture()
  context.hooks.read = async () => {
    await Promise.resolve()
    const source = context.sources[evaluation]!
    context.sources[evaluation] = { ...source, dependencies: [...source.dependencies.slice(0, -1), {}] }
  }
  expect(await context.observe(evaluation)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health rejects access revocation during its metadata read", async () => {
  const context = await fixture()
  context.hooks.read = async () => { await Promise.resolve(); context.controls.revision = "revoked" }
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health rejects source revisions that change between metadata observations", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async (surface, snapshot) => {
    if (surface !== "dashboard") return
    await Promise.resolve()
    const state = object(snapshot.data.__sfProductV1)
    state.revision = Number(state.revision) + ++reads
  }
  expect(await context.observe(sensitivity)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health closes the original UI lease after source failure", async () => {
  const context = await fixture()
  context.hooks.read = async () => { throw new Error("Original state unavailable") }
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health publishes no readiness when finish disposes the installation", async () => {
  const context = await fixture()
  context.hooks.finish = () => { context.controls.installed = false }
  expect(await context.observe(sensitivity)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health requires initialized canonical C08 state", async () => {
  const context = await fixture()
  delete context.memory.state.dashboard.data.__sfProductV1
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio health rejects an aborted original request and finishes admission", async () => {
  const context = await fixture()
  context.hooks.read = async () => { await Promise.resolve(); context.controller.abort() }
  expect(await context.observe(evaluation)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})

test("portfolio evaluations require the original installed transaction function", async () => {
  const context = await fixture()
  const original = context.input.state.transaction
  context.input.state.transaction = (...args) => original(...args)
  expect(await context.observe(evaluation)).toEqual([])
  expect(context.admitted).toHaveLength(0)
  context.terminal()
})

test("portfolio health rejects a substituted canonical state reader", async () => {
  const context = await fixture()
  const original = context.input.state.read
  context.input.state.read = (...args) => original(...args)
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(0)
  context.terminal()
})

test("portfolio health requires final revalidation of its actual UI lease", async () => {
  const context = await fixture()
  context.input.ui.revalidate = async () => false
  expect(await context.observe(history)).toEqual([])
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})
