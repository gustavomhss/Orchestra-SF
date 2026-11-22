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
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions } from "../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { observeSfDashboardDraftHealth } from "../src/sucafina-product/native-ui/dashboard-draft-health.ts"
import { observeSfDecisionIntentHealth } from "../src/sucafina-product/native-ui/decision-intent-health.ts"

type DraftInput = Parameters<typeof observeSfDashboardDraftHealth>[0]
type IntentInput = Parameters<typeof observeSfDecisionIntentHealth>[0]
type Operation = Parameters<DraftInput["source"]>[0] | Parameters<IntentInput["source"]>[0]
type Source = NonNullable<ReturnType<DraftInput["source"]>>
const draftOperations = [
  "dashboard.dashboard-workbench", "dashboard.dashboard-hot-topic-source", "dashboard.dashboard-draft-read",
  "dashboard.dashboard-hot-topic-draft", "dashboard.dashboard-hot-topic-drafts",
  "dashboard.dashboard-hot-topic-draft-outcome", "dashboard.dashboard-capture",
] as const
const intentOperations = [
  "decisions.command.sf_case_draft", "decisions.decision-edit", "decisions.controls.read",
  "bi.bi-options", "bi.bi-data", "bi.bi-source", "bi.bi-decision",
] as const
const stamp = Object.freeze({
  installationId: "draft-intent-health-installation", projectId: "draft-intent-health-project", hostId: "draft-intent-health-host",
  principalRef: "draft-intent-health-person", policyVersion: "draft-intent-health-policy", accessRevision: "draft-intent-health-access",
})
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

/**
 * Original SQLite, current-choice ownership, source lifecycle, C08 and UI leases.
 * Only the external identity/grant boundaries and replacement hooks are controlled.
 * Mounted producer functions deliberately throw if invoked; no result is supplied.
 */
async function fixture(kind: "draft" | "intent") {
  const operations = kind === "draft" ? draftOperations : intentOperations
  const controls: {
    allowed: boolean; revision: string; installed: boolean; calls: number
    deniedOperation: string; deniedNamespace: string; deniedWriteNamespace: string; humanAllowed: boolean
  } = {
    allowed: true, revision: stamp.accessRevision, installed: true, calls: 0,
    deniedOperation: "", deniedNamespace: "", deniedWriteNamespace: "", humanAllowed: true,
  }
  const hooks: {
    read?: (surface: Surface, snapshot: Snapshot) => Promise<void>
    finish?: () => void
    human?: (call: number) => Promise<void>
  } = {}
  const counts = { validates: 0, revalidates: 0, human: 0 }
  const directory = await mkdtemp(path.join(tmpdir(), "sf-draft-intent-health-"))
  const storage = await openLocalStore(directory)
  cleanups.push(async () => { await storage.dispose(); await rm(directory, { recursive: true, force: true }) })
  const never = async (): Promise<never> => {
    controls.calls++
    throw new Error("Health must not invoke draft, capture, controls, BI, dispatch, receipts or source handlers")
  }
  const driver: Parameters<typeof createSfSourcePersistence>[0]["persistence"] = {
    ...storage,
    transaction: (surface, work, options) => storage.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
      await hooks.read?.(surface, snapshot)
      return work(snapshot, blobs)
    }, options),
  }
  const allSnapshots = storage.transactionAll
  if (typeof allSnapshots !== "function") throw new Error("Original SQLite snapshot transaction required")
  const snapshotDigest = () => allSnapshots(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
  let ids = 0
  const identity = () => controls.allowed ? {
    installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
    policyVersion: stamp.policyVersion, accessRevision: controls.revision,
  } : undefined
  const originalUi = createSfUiAuthority({
    authorize: async (_request, operation) => operation === controls.deniedOperation ? undefined : identity(),
    commandIdentity: async () => "command-" + ++ids, createId: () => "lease-" + ++ids,
    now: () => Date.parse("2026-11-21T12:00:00.000Z"),
  })
  const admitted: TrustedUiContext[] = [], finished: TrustedUiContext[] = []
  const ui = {
    ...originalUi,
    admit: async (...args: Parameters<typeof originalUi.admit>) => {
      const result = await originalUi.admit(...args)
      if (result.status === "ok") admitted.push(result.value)
      return result
    },
    validate: async (...args: Parameters<typeof originalUi.validate>) => {
      counts.validates++
      return originalUi.validate(...args)
    },
    revalidate: async (context: TrustedUiContext) => {
      counts.revalidates++
      return originalUi.revalidate(context)
    },
    finish: (context: TrustedUiContext) => {
      finished.push(context)
      originalUi.finish(context)
      hooks.finish?.()
    },
  }
  const choiceFence = createCurrentChoiceFence({
    persistence: driver,
    host: () => { throw new Error("Metadata health must not enter a case execution scope") },
    operationIdentity: () => undefined,
    identity: () => ({ installationId: stamp.installationId, projectId: stamp.projectId }),
  })
  if (!currentChoiceOwnsSnapshotTransactions(choiceFence, driver))
    throw new Error("Original current-choice transaction ownership required")
  const sourcePersistence = createSfSourcePersistence({
    persistence: choiceFence.persistence, enumerate: () => [], createId: () => "source-" + ++ids,
  })
  const transactionAll = sourcePersistence.transactionAll, holdTargetPreimage = storage.holdTargetPreimage
  if (typeof transactionAll !== "function" || typeof holdTargetPreimage !== "function")
    throw new Error("Original SQLite installed snapshot capabilities required")
  const persistence = {
    ...sourcePersistence,
    dashboardSourceFence: Object.freeze({
      transaction: sourcePersistence.transaction, transactionAll,
      currentSnapshots: sourcePersistence.currentSnapshots, currentSnapshot: sourcePersistence.currentSnapshot,
      observeAuthority: sourcePersistence.observeAuthority, readSealed: sourcePersistence.readSealed,
      hasSnapshotRoot: sourcePersistence.hasSnapshotRoot, readDashboardAuthority: sourcePersistence.readDashboardAuthority,
      holdTargetPreimage,
      current: () => currentChoiceOwnsSnapshotTransactions(choiceFence, driver),
    }),
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await sourcePersistence.initializeSources(surface)
  const controller = new AbortController()
  const request = new Request("https://draft-intent-health.example/sucafina/api/ui/context", { signal: controller.signal })
  const state = createSfProductState({
    persistence, createId: () => "state-" + ++ids, resolveTarget: async () => ({ incarnation: "health-workspace" }),
    authorize: async (_request, _snapshot, namespace, mode) => {
      const actor = namespace === controls.deniedNamespace || mode === "write" && namespace === controls.deniedWriteNamespace
        ? undefined : identity()
      return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const initialized = await state.transaction(request, {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: "health-workspace",
    targetIncarnation: "health-workspace", idempotencyKey: "initialize-draft-intent-health",
    commandDigest: digestSfValue({ purpose: "initialize-draft-intent-health" }),
  }, async () => ({ commit: true, value: true }))
  expect(initialized.status).toBe("ok")
  const sources: Partial<Record<Operation, Source>> = {}
  for (const id of [...draftOperations, ...intentOperations]) sources[id] = {
    producer: never, handler: never, operation: never, dependencies: [never, persistence],
  }
  const installed = Object.freeze({})
  let selected: Operation | undefined
  const input: DraftInput & IntentInput = {
    ui, state,
    source: (id: Operation) => !selected || selected === id ? sources[id] : undefined,
    binding: (id, producer) => {
      const mounted = operations.find((operation) => operation === id)
      return controls.installed && mounted && sources[mounted]?.producer === producer ? installed : undefined
    },
    humanActions: async () => {
      const call = ++counts.human
      const actions = controls.humanAllowed ? ["decisions.edit", "reviews.preserve"] : []
      await hooks.human?.(call)
      return actions
    },
  }
  const observe = (operation?: Operation) => {
    selected = operation
    return kind === "draft" ? observeSfDashboardDraftHealth(input, request, stamp) : observeSfDecisionIntentHealth(input, request, stamp)
  }
  const terminal = () => {
    expect(finished.length).toBe(admitted.length)
    expect(new Set(finished).size).toBe(admitted.length)
    for (const lease of admitted) expect(originalUi.requestFor(lease)).toBeUndefined()
    expect(controls.calls).toBe(0)
  }
  return { operations, observe, controls, hooks, counts, sources, storage, snapshotDigest, admitted, finished,
    terminal, request, controller, input, persistence }
}

for (const kind of ["draft", "intent"] as const) {
  const expectedReads = kind === "draft" ? 8 : 4
  const phaseReads = expectedReads / 2
  const writes: readonly Operation[] = kind === "draft"
    ? ["dashboard.dashboard-hot-topic-draft", "dashboard.dashboard-capture"]
    : ["decisions.command.sf_case_draft", "decisions.decision-edit"]
  const human: readonly Operation[] = kind === "draft"
    ? ["dashboard.dashboard-hot-topic-draft", "dashboard.dashboard-hot-topic-draft-outcome", "dashboard.dashboard-capture"]
    : ["decisions.decision-edit"]
  const target: Operation = kind === "draft" ? "dashboard.dashboard-workbench" : "bi.bi-source"

  test(kind + " shares only namespace metadata while preserving every original admission and validation", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface) => { if (surface === "dashboard") reads++ }
    const before = await context.snapshotDigest()
    expect(await context.observe()).toEqual(context.operations.map((operationId) => ({
      operationId, state: "ready", reason: null, operational: true,
    })))
    expect(reads).toBe(expectedReads)
    expect(context.admitted).toHaveLength(7)
    expect(context.counts.validates).toBe(7)
    expect(context.counts.revalidates).toBe(kind === "draft" ? 7 : 14)
    expect(context.counts.human).toBe(kind === "draft" ? 6 : 2)
    expect(await context.snapshotDigest()).toBe(before)
    context.terminal()
  })

  test(kind + " creates fresh phase promises in every later invocation", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface) => { if (surface === "dashboard") reads++ }
    expect((await context.observe()).map((entry) => entry.operationId)).toEqual([...context.operations])
    expect((await context.observe()).map((entry) => entry.operationId)).toEqual([...context.operations])
    expect(reads).toBe(expectedReads * 2)
    expect(context.admitted).toHaveLength(14)
    context.terminal()
  })

  test(kind + " does not share a read grant with a namespace write", async () => {
    const context = await fixture(kind)
    context.controls.deniedWriteNamespace = kind === "draft" ? "preferences" : "cases"
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(context.operations.filter((id) => !writes.includes(id)))
    context.terminal()
  })

  test(kind + " preserves the original human-action denial for each affected candidate", async () => {
    const context = await fixture(kind)
    context.controls.humanAllowed = false
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(context.operations.filter((id) => !human.includes(id)))
    expect(context.admitted).toHaveLength(7)
    context.terminal()
  })

  test(kind + " preserves the original operation admission denial before reading metadata", async () => {
    const context = await fixture(kind)
    context.controls.deniedOperation = kind === "draft" ? "sf_dashboard_read" : "sf_case_draft"
    if (kind === "draft") context.hooks.read = async () => { throw new Error("Denied action must not read") }
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(kind === "draft" ? [] : context.operations.filter((id) => id !== "decisions.command.sf_case_draft"))
    expect(context.admitted).toHaveLength(kind === "draft" ? 0 : 6)
    context.terminal()
  })

  test(kind + " requires the original mounted binding", async () => {
    const context = await fixture(kind)
    context.controls.installed = false
    expect(await context.observe()).toEqual([])
    expect(context.admitted).toHaveLength(0)
    context.terminal()
  })

  test(kind + " isolates exact dependency replacement from other candidates", async () => {
    const context = await fixture(kind)
    context.hooks.read = async () => {
      const source = context.sources[target]!
      context.sources[target] = { ...source, dependencies: [...source.dependencies.slice(0, -1), {}] }
    }
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(context.operations.filter((id) => id !== target))
    context.terminal()
  })

  test(kind + " refuses a producer replaced during a shared read without invoking it", async () => {
    const context = await fixture(kind)
    const replacement = async () => { context.controls.calls++; throw new Error("Replacement must not run") }
    context.hooks.read = async () => {
      const source = context.sources[target]!
      context.sources[target] = { ...source, producer: replacement }
    }
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(context.operations.filter((id) => id !== target))
    context.terminal()
  })

  test(kind + " refuses namespace revisions changed between its two phases", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface, snapshot) => {
      if (surface !== "dashboard" || ++reads <= phaseReads) return
      const state = object(snapshot.data.__sfProductV1)
      state.revision = Number(state.revision) + 1
    }
    expect(await context.observe()).toEqual([])
    expect(reads).toBe(expectedReads)
    context.terminal()
  })

  test(kind + " rechecks original authority after a shared phase boundary", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface) => {
      if (surface === "dashboard" && ++reads > phaseReads) context.controls.revision = "revoked-between-phases"
    }
    expect(await context.observe()).toEqual([])
    expect(reads).toBeGreaterThan(phaseReads)
    expect(context.admitted).toHaveLength(7)
    context.terminal()
  })

  test(kind + " isolates a rejected shared read by mode and drops its promise after the invocation", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface) => {
      if (surface === "dashboard" && ++reads === 1) throw new Error("Original metadata read failed")
    }
    const survivors = kind === "draft" ? writes : context.operations.filter((id) => !writes.includes(id))
    expect((await context.observe()).map((entry) => entry.operationId)).toEqual([...survivors])
    expect(reads).toBe(kind === "draft" ? 6 : 3)
    expect((await context.observe()).map((entry) => entry.operationId)).toEqual([...context.operations])
    expect(reads).toBe((kind === "draft" ? 6 : 3) + expectedReads)
    expect(context.admitted).toHaveLength(14)
    context.terminal()
  })

  test(kind + " closes every lease after an abort during a shared read", async () => {
    const context = await fixture(kind)
    context.hooks.read = async () => { await Promise.resolve(); context.controller.abort() }
    expect(await context.observe()).toEqual([])
    expect(context.admitted).toHaveLength(7)
    context.terminal()
  })

  test(kind + " pins the canonical reader before queued scoped sibling reads", async () => {
    const context = await fixture(kind)
    const root = context.storage.readSnapshotRoot
    if (typeof root !== "function") throw new Error("Original SQLite readonly root required")
    const original = context.input.state.read
    let replaced = false, replacementCalls = 0
    context.hooks.read = async (surface) => {
      if (surface !== "dashboard" || replaced) return
      replaced = true
      context.input.state.read = (...args) => { replacementCalls++; return original(...args) }
    }
    expect(await root(async () => context.observe())).toEqual([])
    expect(replaced).toBe(true)
    expect(replacementCalls).toBe(0)
    expect(context.admitted).toHaveLength(7)
    context.terminal()
  })

  test(kind + " retains the second human-action check after both metadata phases", async () => {
    const context = await fixture(kind)
    let reads = 0
    context.hooks.read = async (surface) => {
      if (surface === "dashboard" && ++reads > phaseReads) context.controls.humanAllowed = false
    }
    expect((await context.observe()).map((entry) => entry.operationId))
      .toEqual(context.operations.filter((id) => !human.includes(id)))
    expect(context.counts.human).toBe(kind === "draft" ? 6 : 2)
    context.terminal()
  })

  test(kind + " closes every lease even if one original finish throws", async () => {
    const context = await fixture(kind)
    let finishes = 0
    context.hooks.finish = () => { if (++finishes === 1) throw new Error("Original lease finish failed") }
    expect(await context.observe()).toHaveLength(6)
    expect(finishes).toBe(7)
    context.terminal()
  })

  test(kind + " publishes no readiness if finishing a lease disposes the installation", async () => {
    const context = await fixture(kind)
    context.hooks.finish = () => { context.controls.installed = false }
    expect(await context.observe()).toEqual([])
    context.terminal()
  })

  test(kind + " requires initialized original C08 state", async () => {
    const context = await fixture(kind)
    await context.storage.transaction("dashboard", async (snapshot: Snapshot) => {
      delete snapshot.data.__sfProductV1
      return { commit: true, value: true }
    })
    expect(await context.observe()).toEqual([])
    expect(context.admitted).toHaveLength(7)
    context.terminal()
  })
}

test("intent retains revalidate after the second human-action observation revokes access", async () => {
  const context = await fixture("intent")
  context.hooks.human = async (call) => {
    if (call === 2) context.controls.revision = "revoked-after-first-revalidation"
  }
  expect(await context.observe("decisions.decision-edit")).toEqual([])
  expect(context.counts.human).toBe(2)
  expect(context.counts.revalidates).toBe(2)
  expect(context.admitted).toHaveLength(1)
  context.terminal()
})
