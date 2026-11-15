import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AssetPersistence, BlobTransaction } from "../../../runtime/assets.ts"
import type { Persistence, Snapshot, TransactionOptions } from "../../../runtime/contract.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Surface } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createCurrentChoiceFence } from "../../../product/decisions/current-choice-preview.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { readPortfolioSnapshot } from "../../../product/portfolio/read-snapshot.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
type ReadPersistence = AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots" | "readSnapshotRoot">

/** Real SQLite, UI lease and canonical wrappers. Fixture rows make no financial
 * claim. The enumerator identifies this fixture's one record on each surface;
 * source admission, identity validation and fence publication are production code. */
export async function createCanonicalReadFixture(options: {
  wrapper?: "source" | "fence"
  legacy?: boolean
  initialized?: readonly Surface[]
  rows?: number
} = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-readonly-root-canonical-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const abort = new AbortController()
  const request = new Request("https://example.test/readonly-root", {
    headers: { authorization: "readonly-root-fixture" }, signal: abort.signal,
  })
  const identity = {
    installationId: "readonly-installation", projectId: "readonly-project", principalRef: "readonly-principal",
    policyVersion: "readonly-policy", accessRevision: "readonly-access",
  }
  const metrics = {
    roots: 0, snapshots: 0, authorizations: 0, revalidations: 0,
    transactions: { dashboard: 0, planner: 0, procurement: 0 },
    callbacks: { dashboard: 0, planner: 0, procurement: 0 },
    events: [] as string[],
  }
  const controls: {
    enabled: boolean
    requestOverride?: Request
    identityOverride?: { installationId: string; projectId: string }
    onRevalidate?: (index: number) => void | Promise<void>
  } = { enabled: true }
  const ui = createSfUiAuthority({
    authorize: async (incoming) => {
      metrics.authorizations++
      metrics.events.push("authorize")
      return controls.enabled && incoming === request && incoming.headers.get("authorization") === "readonly-root-fixture" ? identity : undefined
    },
    commandIdentity: async () => "readonly-root-operation",
    createId: () => "readonly-root-ui-request", now: () => Date.parse("2026-11-15T00:00:00Z"),
  })
  const intent = digestSfValue({ fixture: "readonly-root" })
  const admitted = await ui.admit(request, "sf_case_read", intent)
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", intent)) {
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    throw new Error("Readonly root fixture UI admission unavailable")
  }
  const context = admitted.value
  const host = {
    persistence: driver as Persistence,
    requestFor: (trusted: TrustedDomainContext) => trusted.kind === "ui" ? controls.requestOverride ?? ui.requestFor(trusted) : undefined,
    revalidate: async (trusted: TrustedDomainContext) => {
      metrics.revalidations++
      metrics.events.push("revalidate")
      await controls.onRevalidate?.(metrics.revalidations)
      return trusted.kind === "ui" && await ui.revalidate(trusted)
    },
  }
  const fence = createCurrentChoiceFence({
    persistence: driver, host: () => host, identity: () => controls.identityOverride ?? identity,
    operationIdentity: (trusted) => trusted.kind === "ui" ? ui.operationIdentity(trusted) : undefined,
  })
  let sourceId = 0
  const sources = createSfSourcePersistence({
    persistence: fence.persistence,
    enumerate: (surface, snapshot) => [{ recordType: "readonly-fixture", recordId: surface, inputDigest: digestSfValue(snapshot.data) }],
    createId: () => `readonly-source-${++sourceId}`,
  })
  try {
    for (const surface of surfaces) {
      await driver.transaction(surface, async (snapshot) => {
        snapshot.data.marker = surface
        snapshot.data.readonlyRootRows = Array.from({ length: options.rows ?? 4 }, (_, index) => ({
          __readonlyRootSurface: surface, index, amount: 1000 + index,
          detail: { label: `${surface}-row-${index}`, active: index % 2 === 0, values: [index, index + 1] },
        }))
        return { commit: true, value: undefined }
      })
    }
    for (const surface of options.initialized ?? surfaces) await sources.initializeSources(surface)
  } catch (error) {
    ui.finish(context)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
  const canonical: ReadPersistence = options.wrapper === "fence" ? fence.persistence : sources
  const capablePersistence: ReadPersistence = {
    ...canonical,
    transaction: <T>(surface: Surface, work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>, transactionOptions?: TransactionOptions) => {
      metrics.transactions[surface]++
      metrics.events.push(`transaction:${surface}`)
      return canonical.transaction(surface, async (snapshot, blobs) => {
        metrics.callbacks[surface]++
        metrics.events.push(`callback:${surface}`)
        return work(snapshot, blobs)
      }, transactionOptions)
    },
    ...(canonical.currentSnapshots ? { currentSnapshots: () => {
      metrics.snapshots++
      metrics.events.push("currentSnapshots")
      return canonical.currentSnapshots!()
    } } : {}),
    ...(canonical.readSnapshotRoot ? { readSnapshotRoot: <T>(work: () => Promise<T>, transactionOptions?: TransactionOptions) => {
      metrics.roots++
      return canonical.readSnapshotRoot!(work, transactionOptions)
    } } : {}),
  }
  const legacyPersistence = { ...capablePersistence }
  delete legacyPersistence.readSnapshotRoot
  const persistence = options.legacy ? legacyPersistence : capablePersistence
  host.persistence = persistence
  const resetMetrics = () => {
    metrics.roots = 0
    metrics.snapshots = 0
    metrics.authorizations = 0
    metrics.revalidations = 0
    for (const surface of surfaces) {
      metrics.transactions[surface] = 0
      metrics.callbacks[surface] = 0
    }
    metrics.events.length = 0
  }
  resetMetrics()
  return {
    directory, driver, persistence, capablePersistence, legacyPersistence, host, fence, sources,
    ui, context, request, abort, identity, controls, metrics, resetMetrics,
    read: (work: () => Promise<boolean>, refused = false, incoming: unknown = {}) => readPortfolioSnapshot(host, context, incoming, work, refused),
    withinFence: <T>(work: () => Promise<T>) => fence.run(context, work),
    close: async () => {
      ui.finish(context)
      await driver.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}
