import { expect, test } from "bun:test"
import type { CapabilityDescriptor, TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import { createSfProductState } from "../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfUiAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import type { AssetPersistence, BlobTransaction } from "../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { ProcurementModule } from "../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import type { Surface } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { empty, testPersistence } from "../../../modules/sucafina/Sucafinav1/test/fixture/persistence.ts"
import { observeSfSearchHealth, observeSfWorkHealth } from "../src/sucafina-product/native-ui/work-health.ts"

type WorkSource = NonNullable<ReturnType<Parameters<typeof observeSfWorkHealth>[0]["source"]>>
type SearchSource = NonNullable<ReturnType<Parameters<typeof observeSfSearchHealth>[0]["source"]>>
type Kind = "work" | "search"

const stamp = Object.freeze({
  installationId: "health-installation", projectId: "health-project", hostId: "health-host",
  principalRef: "health-person", policyVersion: "health-policy", accessRevision: "health-access",
})
const privateCommands = ["sf-human:collaboration.work.list", "sf-human:collaboration.work.destination"]

/**
 * Original lease/state/source-lifecycle implementations over the existing isolated
 * test driver. Boundary callbacks control revocation and scheduling; no serialized
 * ready result, source reference, receipt or authority context is supplied.
 */
async function fixture() {
  const controls: { allowed: boolean; revision: string; installed: boolean; calls: number } = {
    allowed: true, revision: stamp.accessRevision, installed: true, calls: 0,
  }
  const hooks: { read?: (surface: Surface, snapshot: Snapshot) => Promise<void> } = {}
  const memory = testPersistence({
    procurement: { ...empty(), data: { store: { settings: { currency: "USD" } } } },
  })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not invoke a selection, item, destination, search, dispatch or blob operation")
  }
  const blobs: BlobTransaction = { get: never, put: never, remove: never }
  const driver: AssetPersistence = {
    transaction: (surface, work, options) => memory.persistence.transaction(surface, async (snapshot) => {
      await hooks.read?.(surface, snapshot)
      return work(snapshot, blobs)
    }, options),
  }
  let ids = 0
  const persistence = createSfSourcePersistence({
    persistence: driver,
    enumerate: (surface, snapshot) => surface === "procurement"
      ? [{ recordType: "procurement-request-selection", recordId: "all", inputDigest: digestSfValue(snapshot.data.store) }]
      : [],
    createId: () => "source-" + ++ids,
  })
  await persistence.initializeSources("dashboard")
  await persistence.initializeSources("procurement")
  const request = new Request("https://health.example/sucafina/api/ui/context")
  const identity = () => controls.allowed ? {
    installationId: stamp.installationId, projectId: stamp.projectId,
    principalRef: stamp.principalRef, policyVersion: stamp.policyVersion, accessRevision: controls.revision,
  } : undefined
  const originalUi = createSfUiAuthority({
    authorize: async () => identity(),
    commandIdentity: async () => "command-" + ++ids,
    createId: () => "lease-" + ++ids,
    now: () => Date.parse("2026-11-21T12:00:00.000Z"),
    privateCommands,
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
    },
  }
  const state = createSfProductState({
    persistence,
    authorize: async () => {
      const actor = identity()
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
    createId: () => "state-" + ++ids,
    resolveTarget: async () => ({ incarnation: "health-workspace" }),
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-health-fixture",
    commandDigest: digestSfValue({ purpose: "initialize-health-fixture" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  const authenticate: WorkSource["runtime"]["host"]["authenticate"] = async () => controls.allowed ? {
    id: stamp.principalRef, canWrite: true, roles: [{ surface: "procurement", role: "buyer" }],
  } : null
  const environment: WorkSource["runtime"]["host"]["environment"] = async () => ({
    at: "2026-11-21T12:00:00.000Z", id: () => "unused-health-id", directory: [],
  })
  const runtime: WorkSource["runtime"] = {
    ui, state,
    host: {
      persistence, authenticate, environment,
      requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
      revalidate: async (call) => call.kind === "ui" && await ui.revalidate(call),
    },
    work: { listPresentation: never }, procurementSelections: { create: never },
    workDestinations: { read: never }, productHttp: never,
  }
  const productBinding = async () => undefined
  const work: WorkSource = {
    runtime, projectionBinding: async () => undefined, productBinding,
    application: { authenticate, environment, product: productBinding,
      domains: { dashboard: [], planner: [], procurement: [ProcurementModule] } },
    handlers: [
      { operationId: "projection.work-selection", handle: never },
      { operationId: "projection.work", handle: never },
      { operationId: "projection.work-item", handle: never },
    ],
  }
  // The descriptor is an uninvoked installation-boundary input. Actual input and
  // output schemas stay original; a copied catalog/descriptor is tested below.
  const descriptor: CapabilityDescriptor = {
    id: "sf_knowledge_search", pack: "knowledge", mode: "read",
    inputSchema: sfOperationInputSchemas.sf_knowledge_search,
    outputSchema: sfOperationOutputSchemas.sf_knowledge_search,
    handler: never, handlerExport: "searchDocumentEvidence", producerTask: "WP06.T05",
    grantProfiles: ["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"],
    requiredAuthority: ["documents:read"],
  }
  const search: SearchSource = {
    producer: never, handler: never, service: { documents: { search: never }, descriptors: [descriptor] },
    assets: { persistence }, catalog: [descriptor], dispatch: never,
  }
  const sources: { work: WorkSource | undefined; search: SearchSource | undefined } = { work, search }
  const installed = Object.freeze({})
  const observe = (kind: Kind) => kind === "work"
    ? observeSfWorkHealth({ source: () => sources.work }, request, stamp)
    : observeSfSearchHealth({
      ui, state, persistence, source: () => sources.search,
      binding: (operation, producer) => controls.installed && operation === "files.document-sources" && producer === search.producer
        ? installed : undefined,
    }, request, stamp)
  const terminal = () => {
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const context of admitted) expect(originalUi.requestFor(context)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { observe, controls, hooks, sources, memory, admitted, finished, terminal, state, persistence, ui, request }
}

test("work health observes five installed operations without changing the active selection or state", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  const result = await context.observe("work")
  expect(result.map((entry) => entry.operationId).sort()).toEqual([
    "collaboration.work-destination", "collaboration.work-list", "projection.work", "projection.work-item", "projection.work-selection",
  ])
  expect(result.every((entry) => entry.operational && entry.state === "ready")).toBe(true)
  expect(context.admitted.length).toBe(3)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

test("search health reads Documents metadata without running a private query", async () => {
  const context = await fixture()
  const before = digestSfValue(context.memory.state)
  expect(await context.observe("search")).toEqual([
    { operationId: "projection.search", state: "ready", reason: null, operational: true },
  ])
  expect(context.admitted.length).toBe(1)
  expect(digestSfValue(context.memory.state)).toBe(before)
  context.terminal()
})

for (const kind of ["work", "search"] as const) {
  test(kind + " health fails closed when its installed source is absent", async () => {
    const context = await fixture()
    context.sources[kind] = undefined
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBe(0)
    context.terminal()
  })

  test(kind + " health preserves a denied admission", async () => {
    const context = await fixture()
    context.controls.allowed = false
    context.hooks.read = async () => { throw new Error("Denied health must not read its source") }
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBe(0)
    context.terminal()
  })

  test(kind + " health rejects a source replacement during an awaited read", async () => {
    const context = await fixture()
    context.hooks.read = async () => {
      await Promise.resolve()
      if (kind === "work" && context.sources.work)
        context.sources.work = { ...context.sources.work, projectionBinding: async () => undefined }
      if (kind === "search" && context.sources.search)
        context.sources.search = { ...context.sources.search, catalog: [...context.sources.search.catalog] }
    }
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBeGreaterThan(0)
    context.terminal()
  })

  test(kind + " health rejects an access revision changed during an awaited read", async () => {
    const context = await fixture()
    context.hooks.read = async () => {
      await Promise.resolve()
      context.controls.revision = "revoked-access"
    }
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBeGreaterThan(0)
    context.terminal()
  })

  test(kind + " health rejects inconsistent source revisions across reads", async () => {
    const context = await fixture()
    let reads = 0
    context.hooks.read = async (surface, snapshot) => {
      await Promise.resolve()
      if (surface !== "dashboard") return
      const state = object(snapshot.data.__sfProductV1)
      state.revision = Number(state.revision) + ++reads
    }
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBeGreaterThan(0)
    context.terminal()
  })

  test(kind + " health always finishes the original lease after a source error", async () => {
    const context = await fixture()
    context.hooks.read = async () => { throw new Error("The original source is unavailable") }
    expect(await context.observe(kind)).toEqual([])
    expect(context.admitted.length).toBeGreaterThan(0)
    context.terminal()
  })
}

test("search health requires the mounted document binding and the original descriptor object", async () => {
  const context = await fixture()
  context.controls.installed = false
  expect(await context.observe("search")).toEqual([])
  context.controls.installed = true
  const source = context.sources.search!
  context.sources.search = { ...source, catalog: source.catalog.map((entry) => ({ ...entry })) }
  expect(await context.observe("search")).toEqual([])
  expect(context.admitted.length).toBe(0)
  context.terminal()
})

test("work health does not infer source readiness from callable methods", async () => {
  const context = await fixture()
  // The source identity is deliberately removed from the private test driver.
  // All installed methods remain present, but the canonical collection is gone.
  context.memory.state.procurement.sfSources = undefined
  expect(await context.observe("work")).toEqual([])
  expect(context.admitted.length).toBe(3)
  context.terminal()
})

test("search health rejects a transaction callback replaced during an awaited read", async () => {
  const context = await fixture()
  const original = context.persistence.transaction
  let replaced = false
  context.hooks.read = async (surface) => {
    if (surface !== "dashboard" || replaced) return
    await Promise.resolve()
    replaced = true
    context.persistence.transaction = (surface, work, options) => original(surface, work, options)
  }
  expect(await context.observe("search")).toEqual([])
  expect(replaced).toBe(true)
  expect(context.admitted.length).toBe(1)
  context.terminal()
})

test("work health rechecks the installed binding after all operation leases finish", async () => {
  const context = await fixture()
  const source = context.sources.work!
  const finish = source.runtime.ui.finish
  let finished = 0
  source.runtime.ui.finish = (call) => {
    finish(call)
    if (++finished === 3)
      context.sources.work = { ...source, projectionBinding: async () => undefined }
  }
  expect(await context.observe("work")).toEqual([])
  expect(finished).toBe(3)
  context.terminal()
})
