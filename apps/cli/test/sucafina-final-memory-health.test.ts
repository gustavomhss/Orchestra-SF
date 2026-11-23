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
import { observeSfMemoryReadingHealth } from "../src/sucafina-product/native-ui/memory-health.ts"

type Input = Parameters<typeof observeSfMemoryReadingHealth>[0]
type Operation = Parameters<Input["source"]>[0]
type Source = NonNullable<ReturnType<Input["source"]>>
const catalog = "intelligence.memory-catalog", history = "intelligence.memory-outcome"
const operations = [catalog, "intelligence.memory-conditions", "intelligence.memory-signals", "intelligence.memory-materiality", history] as const
const stamp = Object.freeze({
  installationId: "memory-health-installation", projectId: "memory-health-project", hostId: "memory-health-host",
  principalRef: "memory-health-person", policyVersion: "memory-health-policy", accessRevision: "memory-health-access",
})

/** Original UI leases, C08 reader and source lifecycle; only external revocation is controlled. */
async function fixture() {
  const controls: { allowed: boolean; revision: string; installed: boolean; calls: number; deniedOperation: string; deniedNamespace: string } = {
    allowed: true, revision: stamp.accessRevision, installed: true, calls: 0, deniedOperation: "", deniedNamespace: "",
  }
  const hooks: {
    read?: (surface: Surface, snapshot: Snapshot) => Promise<void>
    admit?: (context: TrustedUiContext) => Promise<void>
    revalidate?: (context: TrustedUiContext) => Promise<void>
    finish?: (context: TrustedUiContext) => void
  } = {}
  const memory = testPersistence({ dashboard: empty(), planner: empty(), procurement: empty() })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not dispatch memory, reconcile signals, select outcomes, compare, mutate or read blobs")
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
    privateCommands: ["sf-human:analysis.read"],
  })
  const admitted: TrustedUiContext[] = [], finished: TrustedUiContext[] = [], validated: TrustedUiContext[] = []
  const revalidated: TrustedUiContext[] = []
  const ui = {
    ...originalUi,
    admit: async (...args: Parameters<typeof originalUi.admit>) => {
      const result = await originalUi.admit(...args)
      if (result.status === "ok") {
        admitted.push(result.value)
        await hooks.admit?.(result.value)
      }
      return result
    },
    validate: async (...args: Parameters<typeof originalUi.validate>) => {
      validated.push(args[0])
      return originalUi.validate(...args)
    },
    revalidate: async (context: TrustedUiContext) => {
      revalidated.push(context)
      const result = await originalUi.revalidate(context)
      await hooks.revalidate?.(context)
      return result
    },
    finish: (context: TrustedUiContext) => {
      finished.push(context)
      originalUi.finish(context)
      hooks.finish?.(context)
    },
  }
  const persistence = createSfSourcePersistence({
    persistence: driver, enumerate: () => [], createId: () => "source-" + ++ids,
  })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const controller = new AbortController()
  const request = new Request("https://memory-health.example/sucafina/api/ui/context", { signal: controller.signal })
  const state = createSfProductState({
    persistence, createId: () => "state-" + ++ids, resolveTarget: async () => ({ incarnation: "health-workspace" }),
    authorize: async (_request, _snapshot, namespace) => {
      const actor = namespace === controls.deniedNamespace ? undefined : identity()
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-memory-health",
    commandDigest: digestSfValue({ purpose: "initialize-memory-health" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  // Installed route functions are never called by health. Only original authority and C08 observations can yield readiness.
  const memoryReader: Source["memory"] = {
    catalog: ["planner-conditions", "planner-materiality", "planner-signals", "planner-closed-month-outcomes"],
    conditions: never, signals: never, materiality: never, outcomes: never,
    registry: { list: never }, outcomeSelections: { select: never, readReference: never },
  }
  const scenarios: Source["scenarios"] = { resolve: never }
  const source = { producer: never, handler: never, memory: memoryReader, scenarios,
    dependencies: [never, persistence] } satisfies Source
  const sources: Record<Operation, Source | undefined> = {
    [catalog]: source, "intelligence.memory-conditions": source, "intelligence.memory-signals": source,
    "intelligence.memory-materiality": source, [history]: source,
  }
  const installed = Object.freeze({})
  let selected: Operation | undefined
  const input: Input = {
    ui, state, persistence, source: (id) => !selected || selected === id ? sources[id] : undefined,
    binding: (id, producer) => controls.installed && operations.includes(id) && sources[id]?.producer === producer
      ? installed : undefined,
  }
  const observe = (operation?: Operation) => {
    selected = operation
    return observeSfMemoryReadingHealth(input, request, stamp)
  }
  const terminal = () => {
    expect(validated.length).toBe(admitted.length)
    expect(new Set(validated).size).toBe(admitted.length)
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const lease of admitted) expect(originalUi.requestFor(lease)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { observe, controls, hooks, sources, memory, admitted, finished, revalidated,
    revokeLease: (context: TrustedUiContext) => originalUi.finish(context),
    terminal, request, controller, input, persistence }
}

test("memory health observes five installed GET readers without invoking any memory producer", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  let reads = 0
  context.hooks.read = async () => { reads++ }
  expect(await context.observe()).toEqual(operations.map((operationId) => ({
    operationId, state: "ready", reason: null, operational: true,
  })))
  expect(context.admitted.length).toBe(5)
  expect(reads).toBe(4)
  expect(context.revalidated).toHaveLength(25)
  for (const lease of context.admitted) expect(context.revalidated.filter((entry) => entry === lease)).toHaveLength(5)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

for (const operation of operations) {
  test(operation + " requires its original mounted binding", async () => {
    const context = await fixture()
    context.controls.installed = false
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  test(operation + " preserves original analysis.read denial", async () => {
    const context = await fixture()
    context.controls.deniedOperation = "sf-human:analysis.read"
    context.hooks.read = async () => { throw new Error("Denied operation must not read metadata") }
    expect(await context.observe(operation)).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  for (const namespace of ["cases", "preferences"]) {
    test(operation + " requires original " + namespace + " authority", async () => {
      const context = await fixture()
      context.controls.deniedNamespace = namespace
      expect(await context.observe(operation)).toEqual([])
      expect(context.admitted).toHaveLength(1)
      context.terminal()
    })
  }

  test(operation + " rejects dependency replacement during the original metadata read", async () => {
    const context = await fixture()
    context.hooks.read = async () => {
      await Promise.resolve()
      const source = context.sources[operation]!
      context.sources[operation] = { ...source, dependencies: [...source.dependencies.slice(0, -1), {}] }
    }
    expect(await context.observe(operation)).toEqual([])
    context.terminal()
  })

  test(operation + " rejects access revocation during the read", async () => {
    const context = await fixture()
    context.hooks.read = async () => { await Promise.resolve(); context.controls.revision = "revoked" }
    expect(await context.observe(operation)).toEqual([])
    context.terminal()
  })

  test(operation + " rejects a changed C08 revision", async () => {
    const context = await fixture()
    let reads = 0
    context.hooks.read = async (surface, snapshot) => {
      if (surface !== "dashboard") return
      await Promise.resolve()
      const state = object(snapshot.data.__sfProductV1)
      state.revision = Number(state.revision) + ++reads
    }
    expect(await context.observe(operation)).toEqual([])
    context.terminal()
  })

  test(operation + " finishes its single-use lease on source failure", async () => {
    const context = await fixture()
    context.hooks.read = async () => { throw new Error("Original state unavailable") }
    expect(await context.observe(operation)).toEqual([])
    context.terminal()
  })

  test(operation + " never publishes after finish disposes the binding", async () => {
    const context = await fixture()
    context.hooks.finish = () => { context.controls.installed = false }
    expect(await context.observe(operation)).toEqual([])
    context.terminal()
  })
}

test("memory health retains only catalog and outcomes when the original scenario source is absent", async () => {
  const context = await fixture()
  for (const operation of operations) {
    const source = context.sources[operation]!
    context.sources[operation] = { ...source, scenarios: undefined,
      memory: { ...source.memory, catalog: ["planner-closed-month-outcomes"] } }
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual([catalog, history])
  context.terminal()
})

test("memory catalog does not treat declared methods as original C08 infrastructure", async () => {
  const context = await fixture()
  delete context.memory.state.dashboard.data.__sfProductV1
  expect(await context.observe(catalog)).toEqual([])
  context.terminal()
})

test("memory health rejects a copied callable state reader", async () => {
  const context = await fixture()
  context.input.state = { ...context.input.state }
  expect(await context.observe()).toEqual([])
  expect(context.admitted).toHaveLength(0)
  context.terminal()
})

test("memory health rejects catalog mutation during observation", async () => {
  const context = await fixture()
  context.hooks.read = async () => { context.sources[catalog]!.memory.catalog.length = 0 }
  expect(await context.observe(catalog)).toEqual([])
  context.terminal()
})

test("memory outcome health rejects in-place reader replacement", async () => {
  const context = await fixture()
  context.hooks.read = async () => {
    context.sources[history]!.memory.outcomes = async () => { throw new Error("Replaced outcome reader") }
  }
  expect(await context.observe(history)).toEqual([])
  context.terminal()
})

test("memory health closes an admitted lease when the caller aborts", async () => {
  const context = await fixture()
  context.hooks.read = async () => { await Promise.resolve(); context.controller.abort() }
  expect(await context.observe(catalog)).toEqual([])
  context.terminal()
})

test("memory health observes four C08 reads again on every invocation without a cross-call cache", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async () => { reads++ }
  const first = await context.observe()
  expect(first.map((entry) => entry.operationId)).toEqual([...operations])
  expect(reads).toBe(4)
  expect(await context.observe()).toEqual(first)
  expect(reads).toBe(8)
  expect(context.admitted).toHaveLength(10)
  expect(context.revalidated).toHaveLength(50)
  context.terminal()
})

test("memory health preserves canonical operation order when admissions complete out of order", async () => {
  const context = await fixture()
  let releaseFirst!: () => void
  const first = new Promise<void>((resolve) => { releaseFirst = resolve })
  const completed: number[] = []
  context.hooks.admit = async (lease) => {
    const index = context.admitted.indexOf(lease)
    if (index === 0) await first
    if (index === operations.length - 1) releaseFirst()
    completed.push(index)
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual([...operations])
  expect(completed.at(-1)).toBe(0)
  context.terminal()
})

test("memory health isolates an original lease revoked before single-use validation", async () => {
  const context = await fixture()
  context.hooks.admit = async (lease) => {
    if (context.admitted.indexOf(lease) === 2) context.revokeLease(lease)
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((_, index) => index !== 2))
  expect(context.admitted).toHaveLength(5)
  context.terminal()
})

test("memory health isolates replacement of one mounted source during a shared observation", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async () => {
    if (++reads !== 1) return
    const source = context.sources[history]!
    context.sources[history] = { ...source, dependencies: [...source.dependencies, {}] }
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((id) => id !== history))
  expect(reads).toBe(4)
  expect(context.admitted).toHaveLength(5)
  context.terminal()
})

test("memory health isolates an original lease revoked after its first namespace observation", async () => {
  const context = await fixture()
  let revoked = false
  context.hooks.revalidate = async (lease) => {
    if (!revoked && lease === context.admitted[2]) {
      revoked = true
      context.revokeLease(lease)
    }
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((_, index) => index !== 2))
  expect(revoked).toBe(true)
  expect(context.revalidated.filter((lease) => lease === context.admitted[2])).toHaveLength(1)
  context.terminal()
})

test("memory health isolates a throwing revalidation and still revalidates every other lease", async () => {
  const context = await fixture()
  context.hooks.revalidate = async (lease) => {
    if (lease === context.admitted[2]) throw new Error("One original authority revalidation failed")
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((_, index) => index !== 2))
  expect(context.revalidated.filter((lease) => lease === context.admitted[2])).toHaveLength(1)
  for (const lease of context.admitted.filter((_, index) => index !== 2))
    expect(context.revalidated.filter((entry) => entry === lease)).toHaveLength(5)
  context.terminal()
})

for (const failed of [0, 2, 4]) {
  test("memory health finishes every lease when finish throws for admitted lease " + failed, async () => {
    const context = await fixture()
    context.hooks.finish = (lease) => {
      if (lease === context.admitted[failed]) throw new Error("One lease cleanup failed after original finish")
    }
    expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((_, index) => index !== failed))
    expect(context.finished).toHaveLength(5)
    context.terminal()
  })
}

test("memory health checks every surviving source after all cleanup has completed", async () => {
  const context = await fixture()
  context.hooks.finish = (lease) => {
    if (lease !== context.admitted.at(-1)) return
    const source = context.sources[catalog]!
    context.sources[catalog] = { ...source, dependencies: [...source.dependencies, {}] }
  }
  expect((await context.observe()).map((entry) => entry.operationId)).toEqual(operations.filter((id) => id !== catalog))
  expect(context.finished).toHaveLength(5)
  context.terminal()
})

test("memory health rejects all readers when C08 metadata changes between the two shared observations", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  let reads = 0
  context.hooks.read = async (_surface, snapshot) => {
    if (++reads < 3) return
    const state = object(snapshot.data.__sfProductV1)
    state.revision = Number(state.revision) + 1
  }
  expect(await context.observe()).toEqual([])
  expect(reads).toBe(4)
  expect(context.admitted).toHaveLength(5)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

test("memory health rejects all readers when the shared namespaces have different aggregate revisions", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async (_surface, snapshot) => {
    if (++reads !== 2) return
    const state = object(snapshot.data.__sfProductV1)
    state.revision = Number(state.revision) + 1
  }
  expect(await context.observe()).toEqual([])
  expect(reads).toBe(2)
  expect(context.finished).toHaveLength(5)
  context.terminal()
})

test("memory health finishes all admitted leases when the second shared observation throws", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async () => {
    if (++reads === 3) throw new Error("Original C08 source failed between observations")
  }
  expect(await context.observe()).toEqual([])
  expect(reads).toBe(3)
  expect(context.finished).toHaveLength(5)
  context.terminal()
})

test("memory health finishes all admitted leases when the caller aborts between shared observations", async () => {
  const context = await fixture()
  let reads = 0
  context.hooks.read = async () => {
    if (++reads === 3) context.controller.abort()
  }
  expect(await context.observe()).toEqual([])
  expect(reads).toBe(3)
  expect(context.finished).toHaveLength(5)
  context.terminal()
})
